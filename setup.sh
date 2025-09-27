#!/bin/bash

# Avelero Project Setup Script
# This script helps new team members set up the development environment

set -e

echo "🚀 Welcome to Avelero Setup!"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if bun is installed
check_bun() {
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed. Please install it first:"
        echo "curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    print_success "Bun is installed: $(bun --version)"
}

# Install dependencies
install_deps() {
    print_status "Installing dependencies with Bun..."
    bun install
    print_success "Dependencies installed!"
}

# Setup environment files
setup_env() {
    print_status "Setting up environment files..."

    # Copy .env.example files to .env for each app
    if [ -f "apps/api/.env.example" ]; then
        cp apps/api/.env.example apps/api/.env
        print_success "Created apps/api/.env"
    fi

    if [ -f "apps/app/.env.example" ]; then
        cp apps/app/.env.example apps/app/.env
        print_success "Created apps/app/.env"
    fi

    if [ -f "apps/web/.env.example" ]; then
        cp apps/web/.env.example apps/web/.env
        print_success "Created apps/web/.env"
    fi

    print_warning "Please update the .env files with your actual credentials:"
    echo "  - Supabase URL and keys"
    echo "  - Upstash Redis credentials"
    echo "  - Resend API key"
    echo "  - Other service credentials"
}

# Setup MCP (Model Context Protocol) files
setup_mcp() {
    print_status "Setting up MCP configuration..."

    # Create basic .cursorrules if it doesn't exist
    if [ ! -f ".cursorrules" ]; then
        cat > .cursorrules << 'EOF'
# Cursor Rules for Avelero Project
# This file contains project-specific rules and guidelines

# General Rules
- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use the established folder structure
- Write meaningful commit messages

# Code Quality
- Run linting before committing: bun run lint
- Run type checking: bun run typecheck
- Format code: bun run format

# Testing
- Write tests for new features
- Run tests before committing: bun run test

# Git Workflow
- Create feature branches for new work
- Keep commits small and focused
- Use conventional commit messages
EOF
        print_success "Created .cursorrules"
    fi

    # Create basic mcp.json if it doesn't exist
    if [ ! -f "mcp.json" ]; then
        cat > mcp.json << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/tr4m0ryp/projects/avelero"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "/home/tr4m0ryp/projects/avelero"]
    }
  }
}
EOF
        print_success "Created mcp.json"
    fi
}

# Setup taskmaster (if it exists)
setup_taskmaster() {
    print_status "Setting up Taskmaster..."

    if [ -d ".taskmaster" ]; then
        print_success "Taskmaster directory already exists"
    else
        # Create basic taskmaster structure
        mkdir -p .taskmaster/tasks
        mkdir -p .taskmaster/templates

        # Create basic config
        cat > .taskmaster/config.json << 'EOF'
{
  "version": "1.0",
  "project": "avelero",
  "defaultTemplate": "feature"
}
EOF

        # Create basic task template
        cat > .taskmaster/templates/feature.txt << 'EOF'
# Feature Request Template

## Description
Brief description of the feature

## Requirements
- Requirement 1
- Requirement 2

## Acceptance Criteria
- Criteria 1
- Criteria 2

## Technical Notes
Any technical considerations or implementation details
EOF

        print_success "Created basic Taskmaster configuration"
    fi
}

# Main setup function
main() {
    echo ""
    print_status "Starting Avelero development environment setup..."
    echo ""

    check_bun
    echo ""

    install_deps
    echo ""

    setup_env
    echo ""

    setup_mcp
    echo ""

    setup_taskmaster
    echo ""

    print_success "Setup complete! 🎉"
    echo ""
    echo "Next steps:"
    echo "1. Update your .env files with actual credentials"
    echo "2. Run the development servers:"
    echo "   bun dev          # Start all services"
    echo "   bun dev:app      # Start main app only"
    echo "   bun dev:api      # Start API only"
    echo "   bun dev:web      # Start web app only"
    echo "   bun dev:jobs     # Start job processing"
    echo ""
    echo "3. Useful commands:"
    echo "   bun run lint     # Run linting"
    echo "   bun run format   # Format code"
    echo "   bun run test     # Run tests"
    echo "   bun run build    # Build for production"
    echo ""
    echo "4. Database commands:"
    echo "   bun migrate      # Run database migrations"
    echo "   bun seed         # Seed database with test data"
    echo ""
    echo "Happy coding! 🚀"
}

# Run main function
main "$@"