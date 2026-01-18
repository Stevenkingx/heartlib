#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_error() {
    echo -e "${RED}[-]${NC} $1"
}

# Default configuration
MODEL_PATH="${HEARTMULA_MODEL_PATH:-./ckpt}"
MODEL_VERSION="${HEARTMULA_VERSION:-3B}"
USE_FP16="${HEARTMULA_FP16:-false}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DEV_MODE="${DEV_MODE:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --model-path)
            MODEL_PATH="$2"
            shift 2
            ;;
        --version)
            MODEL_VERSION="$2"
            shift 2
            ;;
        --fp16)
            USE_FP16="true"
            shift
            ;;
        --dev)
            DEV_MODE="true"
            shift
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "HeartMuLa Web UI Launcher"
            echo ""
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --model-path PATH    Path to model checkpoints (default: ./ckpt)"
            echo "  --version VERSION    Model version: 3B or 1B (default: 3B)"
            echo "  --fp16               Use float16 instead of bfloat16"
            echo "  --dev                Run in development mode (hot reload)"
            echo "  --backend-port PORT  Backend server port (default: 8000)"
            echo "  --frontend-port PORT Frontend dev server port (default: 5173)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  HEARTMULA_MODEL_PATH - Path to model checkpoints"
            echo "  HEARTMULA_VERSION    - Model version (3B or 1B)"
            echo "  HEARTMULA_FP16       - Use float16 (true/false)"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_error "Virtual environment not found. Please run ./install.sh first."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if model checkpoints exist
if [ ! -d "$MODEL_PATH/HeartMuLa-oss-$MODEL_VERSION" ]; then
    print_error "Model checkpoints not found at $MODEL_PATH/HeartMuLa-oss-$MODEL_VERSION"
    echo "Please download the checkpoints:"
    echo "  huggingface-cli download jinbridger/HeartMuLa-oss --local-dir $MODEL_PATH"
    exit 1
fi

# Export environment variables
export HEARTMULA_MODEL_PATH="$MODEL_PATH"
export HEARTMULA_VERSION="$MODEL_VERSION"
export HEARTMULA_FP16="$USE_FP16"

# ROCm environment variables (for AMD GPUs)
export ROCM_PATH="${ROCM_PATH:-/opt/rocm}"
export HSA_OVERRIDE_GFX_VERSION="${HSA_OVERRIDE_GFX_VERSION:-12.0.1}"

echo "================================"
echo "HeartMuLa Web UI"
echo "================================"
echo ""
print_status "Model path: $MODEL_PATH"
print_status "Model version: $MODEL_VERSION"
print_status "FP16 mode: $USE_FP16"
echo ""

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
print_status "Starting backend server on port $BACKEND_PORT..."
cd "$SCRIPT_DIR"
python -m uvicorn web.backend.main:app --host 0.0.0.0 --port $BACKEND_PORT &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend failed to start"
    exit 1
fi

print_success "Backend server running at http://localhost:$BACKEND_PORT"

# Start frontend
if [ "$DEV_MODE" = "true" ]; then
    print_status "Starting frontend dev server on port $FRONTEND_PORT..."
    cd "$SCRIPT_DIR/web/frontend"
    npm run dev -- --port $FRONTEND_PORT &
    FRONTEND_PID=$!
else
    # In production mode, serve built files through backend
    # For now, use dev server
    print_status "Starting frontend server on port $FRONTEND_PORT..."
    cd "$SCRIPT_DIR/web/frontend"

    # Check if build exists
    if [ -d "dist" ]; then
        npx serve -s dist -l $FRONTEND_PORT &
        FRONTEND_PID=$!
    else
        print_warning "Production build not found, using dev server..."
        npm run dev -- --port $FRONTEND_PORT &
        FRONTEND_PID=$!
    fi
fi

cd "$SCRIPT_DIR"

# Wait for frontend to start
sleep 2

echo ""
print_success "HeartMuLa Web UI is running!"
echo ""
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  API Docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
