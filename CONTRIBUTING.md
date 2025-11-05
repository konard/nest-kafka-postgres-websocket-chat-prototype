# Contributing to Real-time Chat System

First off, thank you for considering contributing to this project! 🎉

This document provides guidelines for contributing to the Real-time Chat System. Following these guidelines helps maintain code quality and makes the review process smoother.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## 📜 Code of Conduct

This project follows a simple code of conduct:
- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

## 🚀 Getting Started

### Prerequisites

Make sure you have:
- Node.js 18+ installed
- Docker and Docker Compose
- Git
- A code editor (VS Code recommended)

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nest-kafka-postgres-websocket-chat-prototype.git
   cd nest-kafka-postgres-websocket-chat-prototype
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/nest-kafka-postgres-websocket-chat-prototype.git
   ```

4. **Start all services**
   ```bash
   docker-compose up -d --build
   ```

5. **Verify everything works**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000
   - Health check: http://localhost:4000/health

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug:

1. **Check existing issues** - someone might have already reported it
2. **Create a new issue** with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node version, Docker version)

### Suggesting Features

Feature suggestions are welcome! Please:

1. **Check the roadmap** in README.md - it might be already planned
2. **Open an issue** with:
   - Clear use case description
   - Why this feature would be valuable
   - Possible implementation approach
   - Any relevant examples from other projects

### Good First Issues

New to the project? Look for issues labeled:
- `good-first-issue` - beginner-friendly tasks
- `help-wanted` - community help needed
- `documentation` - documentation improvements

## 💻 Development Workflow

### Creating a Feature Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write code** following our [coding standards](#coding-standards)
2. **Test locally**
   ```bash
   # Backend tests
   cd packages/backend
   npm test
   
   # Frontend tests
   cd packages/frontend
   npm test
   ```
3. **Update documentation** if needed
4. **Commit changes** with [good commit messages](#commit-messages)

### Keeping Your Fork Updated

```bash
git fetch upstream
git rebase upstream/main
```

## 📏 Coding Standards

### TypeScript

- Use **TypeScript** for all new code
- Enable strict mode
- Define proper types (avoid `any` when possible)
- Use meaningful variable and function names

### NestJS Backend

```typescript
// ✅ Good
@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: Repository<Message>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async createMessage(dto: CreateMessageDto): Promise<Message> {
    // Implementation
  }
}

// ❌ Bad
@Injectable()
export class MessageService {
  constructor(private repo: any, private kafka: any) {}
  
  async create(data: any): Promise<any> {
    // Implementation
  }
}
```

### React/Next.js Frontend

```typescript
// ✅ Good
interface ChatMessageProps {
  message: ChatMessage;
  onRead: (messageId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRead }) => {
  // Implementation
};

// ❌ Bad
export const ChatMessage = (props: any) => {
  // Implementation
};
```

### File Naming

- **Components**: PascalCase (`ChatMessage.tsx`)
- **Services**: camelCase with .service suffix (`message.service.ts`)
- **Controllers**: camelCase with .controller suffix (`chat.controller.ts`)
- **Types/Interfaces**: PascalCase in separate files (`message.types.ts`)

### Code Style

We use ESLint and Prettier:

```bash
# Format code
npm run format

# Check linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🧪 Testing Guidelines

### Write Tests For:

- ✅ New features
- ✅ Bug fixes
- ✅ Complex business logic
- ✅ API endpoints
- ✅ Service methods

### Test Structure

```typescript
describe('MessageService', () => {
  let service: MessageService;
  let repository: Repository<Message>;

  beforeEach(async () => {
    // Setup
  });

  describe('createMessage', () => {
    it('should create a new message', async () => {
      // Arrange
      const dto = { chatId: '1', content: 'Hello' };
      
      // Act
      const result = await service.createMessage(dto);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBe('Hello');
    });

    it('should throw error for invalid chatId', async () => {
      // Test error cases
    });
  });
});
```

### Test Coverage

Aim for:
- **80%+ coverage** for services
- **70%+ coverage** for controllers
- **100% coverage** for utilities

Check coverage:
```bash
npm run test:cov
```

## 📚 Documentation

### When to Update Documentation

Update docs when you:
- Add a new feature
- Change API endpoints
- Modify WebSocket events
- Add Kafka topics
- Change environment variables
- Fix bugs that affect usage

### Documentation Files

- `/doc/PROJECT_PURPOSE.md` - Project vision and use cases
- `/doc/nest.md` - Backend architecture
- `/doc/kafka.md` - Kafka integration
- `/doc/websocket.md` - WebSocket API
- `/doc/API_REFERENCE.md` - Complete API reference
- `README.md` - Main project documentation

### Documentation Style

```markdown
## Feature Name

### Overview
Brief description of what this feature does.

### Usage

#### Example
\`\`\`typescript
// Code example
\`\`\`

### API Reference

**Endpoint:** `POST /api/messages`

**Request:**
\`\`\`json
{
  "chatId": "chat-123",
  "content": "Hello, World!"
}
\`\`\`

**Response:**
\`\`\`json
{
  "status": "ok",
  "message": { /* message object */ }
}
\`\`\`
```

## 📝 Commit Messages

Use conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# Good commit messages
feat(chat): add message pinning functionality
fix(websocket): resolve connection timeout issue
docs(kafka): update event types documentation
refactor(auth): simplify JWT validation logic
test(message): add unit tests for message service

# Bad commit messages
update stuff
fix bug
changes
asdfasdf
```

### Commit Message Details

```bash
feat(chat): add message pinning functionality

- Add pin/unpin methods to MessageService
- Create pin/unpin WebSocket events
- Update Message entity with pinning fields
- Add Kafka events for pinning

Closes #123
```

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commits follow commit message guidelines
- [ ] Branch is up to date with main

### Creating a Pull Request

1. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open PR on GitHub**
   - Use a clear, descriptive title
   - Reference related issues
   - Describe what changed and why
   - Add screenshots for UI changes
   - Mark as draft if work in progress

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
How to test these changes

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Code follows style guidelines
- [ ] Self-review completed
```

### Review Process

1. **Maintainers will review** your PR
2. **Address feedback** by pushing new commits
3. **Once approved**, maintainers will merge
4. **Celebrate!** 🎉 You've contributed to open source!

### After Merge

```bash
# Update your local main
git checkout main
git pull upstream main

# Delete feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## 🎯 Priority Areas

We especially welcome contributions in:

1. **Missing features from TODO list** (see README.md)
2. **Performance improvements**
3. **Test coverage**
4. **Documentation improvements**
5. **Bug fixes**
6. **UI/UX enhancements**

## 🏆 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Part of our community

## 💬 Questions?

- Open a discussion on GitHub
- Check existing documentation
- Review closed issues and PRs
- Ask in your pull request

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** 🙌

Every contribution, no matter how small, makes this project better.

