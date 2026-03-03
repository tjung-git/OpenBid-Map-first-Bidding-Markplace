#!/bin/bash

echo "🚀 OpenBid Deployment Script"
echo "=============================="

# Install server dependencies
echo ""
echo "📦 Installing server dependencies..."
cd server
if [ ! -d "node_modules" ]; then
  npm install
else
  echo "✓ Server dependencies already installed"
fi
cd ..

# Install client dependencies
echo ""
echo "📦 Installing client dependencies..."
cd client
if [ ! -d "node_modules" ]; then
  npm install
else
  echo "✓ Client dependencies already installed"
fi
cd ..

# Start server in background
echo ""
echo "🔧 Starting server..."
cd server
npm start &
SERVER_PID=$!
cd ..

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 3

# Start client
echo ""
echo "🌐 Starting client..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
echo ""
echo "🌍 Client should be running at: http://localhost:5173"
echo "🔌 Server should be running at: http://localhost:3000"
echo ""
echo "To stop both services, run:"
echo "  kill $SERVER_PID $CLIENT_PID"
echo ""
echo "Or press Ctrl+C and run: pkill -f 'node.*server' && pkill -f 'vite'"

