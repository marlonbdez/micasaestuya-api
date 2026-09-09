# Contributing to Mi Casa Es Tuya API

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feat/my-awesome-feature
   ```
4. **Make your changes** and test them
5. **Commit** with clear messages
6. **Push** to your fork
7. **Open a Pull Request** describing your changes

## Development Setup

### Prerequisites
- Node.js 18+
- npm 8+
- MongoDB (via Docker Compose in `micasaestuya-infra`)
- Redis (via Docker Compose in `micasaestuya-infra`)

### Quick Start
```bash
# Install dependencies
npm install

# Start dev environment (from infra repo)
cd ../micasaestuya-infra
docker-compose up -d

# Return to api and start dev server
cd ../micasaestuya-api
npm run dev
```

### Running Tests
```bash
npm test
```

### Code Style
- Follow existing code style
- Use meaningful variable names
- Write comments for complex logic
- Keep functions small and focused

## Commit Messages

Use clear, descriptive commit messages:
```
feat: Add user authentication endpoint
fix: Resolve property search pagination bug
docs: Update API documentation
test: Add tests for property filters
refactor: Simplify MongoDB queries
```

## Pull Request Guidelines

- **Title**: Keep it short and descriptive
- **Description**: Explain what and why (not just what)
- **Tests**: Include tests for new features
- **Documentation**: Update docs if needed
- **One feature per PR**: Keep PRs focused and reviewable

## Code of Conduct

- Be respectful to all contributors
- Provide constructive feedback
- Welcome new perspectives
- Report issues professionally

## Questions?

Open an **Issue** if you have questions. We're here to help!

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.

---

**Happy coding!** 🚀
