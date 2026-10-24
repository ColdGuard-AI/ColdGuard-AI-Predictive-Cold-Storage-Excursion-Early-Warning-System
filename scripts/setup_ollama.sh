#!/usr/bin/env bash
# ColdGuard AI — Automated Ollama & Fine-Tuned Model Setup Script
# Run: bash scripts/setup_ollama.sh

set -e

echo "═════════════════════════════════════════════════════════════════"
echo "  ColdGuard AI — Storage Manager Assistant Ollama Setup"
echo "═════════════════════════════════════════════════════════════════"

# 1. Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "[!] Ollama CLI is not found on your system."
    echo "[*] To install Ollama on macOS:"
    echo "      brew install ollama"
    echo "    OR download the Mac app from: https://ollama.com/download"
    echo ""
    echo "[*] You can still use the ColdGuard Manager Chatbot right now!"
    echo "    The system automatically runs our built-in local fallback engine"
    echo "    until Ollama is installed and started."
    exit 0
fi

echo "[✓] Found Ollama installation at: $(which ollama)"

# 2. Check if Ollama daemon is running
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "[*] Starting Ollama server in the background..."
    ollama serve &> /dev/null &
    sleep 3
fi

# 3. Pull base model
echo "[*] Pulling base model (llama3:latest)..."
ollama pull llama3:latest

# 4. Create custom ColdGuard Storage Manager model
echo "[*] Building custom 'coldguard-manager' model from Modelfile..."
ollama create coldguard-manager -f Backend/app/assistant/Modelfile

echo "═════════════════════════════════════════════════════════════════"
echo "[✓] Setup complete! 'coldguard-manager' model is ready for local GxP inference."
echo "    Verify with: curl http://localhost:8000/api/assistant/status"
echo "═════════════════════════════════════════════════════════════════"
