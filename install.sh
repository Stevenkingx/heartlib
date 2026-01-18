#!/bin/bash
set -e

echo "================================"
echo "HeartMuLa Web UI Installer"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[-]${NC} $1"
}

# Detect GPU
detect_gpu() {
    print_status "Detecting GPU..."

    if command -v nvidia-smi &> /dev/null; then
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
        if [ -n "$GPU_NAME" ]; then
            print_success "NVIDIA GPU detected: $GPU_NAME"
            GPU_TYPE="nvidia"
            return 0
        fi
    fi

    if command -v rocm-smi &> /dev/null || lspci 2>/dev/null | grep -qi "AMD.*Radeon\|AMD.*Graphics"; then
        GPU_NAME=$(rocm-smi --showproductname 2>/dev/null | grep "Card" | head -1 || echo "AMD GPU")
        if lspci 2>/dev/null | grep -qi "AMD.*Radeon\|AMD.*Graphics"; then
            GPU_NAME=$(lspci 2>/dev/null | grep -i "AMD.*Radeon\|AMD.*Graphics" | head -1 | sed 's/.*: //')
        fi
        print_success "AMD GPU detected: $GPU_NAME"
        GPU_TYPE="amd"
        return 0
    fi

    print_warning "No GPU detected. Will use CPU-only mode (slow)."
    GPU_TYPE="cpu"
    return 0
}

# Check Python version
check_python() {
    print_status "Checking Python..."

    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

        if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 9 ]; then
            print_success "Python $PYTHON_VERSION found"
            PYTHON_CMD="python3"
            return 0
        fi
    fi

    print_error "Python 3.9+ is required but not found"
    echo "Please install Python 3.9 or higher:"
    echo "  Ubuntu/Debian: sudo apt install python3.11 python3.11-venv"
    echo "  Fedora: sudo dnf install python3.11"
    echo "  Arch: sudo pacman -S python"
    exit 1
}

# Check Node.js
check_nodejs() {
    print_status "Checking Node.js..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_success "Node.js $(node -v) found"
            return 0
        fi
    fi

    print_warning "Node.js 18+ not found. Installing via nvm..."

    if [ ! -d "$HOME/.nvm" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    nvm install 20
    nvm use 20

    print_success "Node.js $(node -v) installed"
}

# Create virtual environment
setup_venv() {
    print_status "Setting up Python virtual environment..."

    if [ ! -d "venv" ]; then
        $PYTHON_CMD -m venv venv
        print_success "Virtual environment created"
    else
        print_success "Virtual environment already exists"
    fi

    source venv/bin/activate
}

# Install Python dependencies
install_python_deps() {
    print_status "Installing Python dependencies..."

    pip install --upgrade pip

    # Install PyTorch based on GPU type
    case $GPU_TYPE in
        nvidia)
            print_status "Installing PyTorch with CUDA support..."
            pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
            ;;
        amd)
            print_status "Installing PyTorch with ROCm 7.1 support..."

            # Set ROCm environment variables
            export ROCM_PATH="${ROCM_PATH:-/opt/rocm}"
            export HSA_OVERRIDE_GFX_VERSION="${HSA_OVERRIDE_GFX_VERSION:-12.0.1}"

            pip install --pre torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/rocm7.1

            # Verify ROCm installation
            if python -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
                print_success "ROCm PyTorch verified: $(python -c 'import torch; print(torch.cuda.get_device_name(0))')"
            else
                print_warning "ROCm may need additional configuration. Check HSA_OVERRIDE_GFX_VERSION for your GPU."
            fi
            ;;
        cpu)
            print_status "Installing PyTorch (CPU only)..."
            pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
            ;;
    esac

    # Install heartlib
    print_status "Installing heartlib..."
    pip install -e .

    # Install web backend dependencies
    print_status "Installing web backend dependencies..."
    pip install -r web/backend/requirements.txt

    print_success "Python dependencies installed"
}

# Build frontend
build_frontend() {
    print_status "Building frontend..."

    cd web/frontend

    # Install npm dependencies
    print_status "Installing npm packages..."
    npm install

    # Build for production
    print_status "Building production bundle..."
    npm run build

    cd "$SCRIPT_DIR"

    print_success "Frontend built successfully"
}

# Download model checkpoints
download_models() {
    print_status "Checking model checkpoints..."

    if [ -d "ckpt/HeartMuLa-oss-3B" ] && [ -d "ckpt/HeartCodec-oss" ]; then
        print_success "Model checkpoints already downloaded"
        return 0
    fi

    print_warning "Model checkpoints not found."
    echo ""
    echo "Please download the HeartMuLa checkpoints from Hugging Face:"
    echo ""
    echo "  Option 1 - Using huggingface-cli:"
    echo "    huggingface-cli download jinbridger/HeartMuLa-oss --local-dir ./ckpt"
    echo ""
    echo "  Option 2 - Using modelscope:"
    echo "    modelscope download jinbridger/HeartMuLa-oss --local_dir ./ckpt"
    echo ""
    echo "  Option 3 - Manual download:"
    echo "    Visit: https://huggingface.co/jinbridger/HeartMuLa-oss"
    echo ""

    read -p "Would you like to attempt automatic download? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Downloading model checkpoints..."
        if command -v huggingface-cli &> /dev/null; then
            huggingface-cli download jinbridger/HeartMuLa-oss --local-dir ./ckpt
            print_success "Model checkpoints downloaded"
        else
            print_status "Installing huggingface_hub..."
            pip install huggingface_hub
            huggingface-cli download jinbridger/HeartMuLa-oss --local-dir ./ckpt
            print_success "Model checkpoints downloaded"
        fi
    else
        print_warning "Skipping model download. You'll need to download them manually before using the app."
    fi
}

# Create data directories
create_directories() {
    print_status "Creating data directories..."

    mkdir -p web/data/audio

    print_success "Directories created"
}

# Main installation
main() {
    echo "This script will:"
    echo "  1. Detect your GPU (NVIDIA/AMD/CPU)"
    echo "  2. Set up a Python virtual environment"
    echo "  3. Install PyTorch with appropriate GPU support"
    echo "  4. Install all dependencies"
    echo "  5. Build the web frontend"
    echo "  6. (Optionally) Download model checkpoints"
    echo ""

    read -p "Continue with installation? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi

    echo ""

    detect_gpu
    check_python
    check_nodejs
    setup_venv
    install_python_deps
    build_frontend
    create_directories
    download_models

    echo ""
    echo "================================"
    print_success "Installation complete!"
    echo "================================"
    echo ""
    echo "To start the HeartMuLa Web UI:"
    echo "  ./start.sh"
    echo ""
    echo "The web interface will be available at:"
    echo "  http://localhost:5173"
    echo ""

    if [ "$GPU_TYPE" = "cpu" ]; then
        print_warning "Note: Running on CPU will be very slow. A GPU is recommended."
    fi
}

main "$@"
