# CLAUDE.md — Project Git Workflow & Rules

> **This file governs how Claude Code interacts with Git and GitHub on this project.**
> All team members using Claude Code will inherit these rules automatically.

---

## 1. Branch Structure

This project uses a **two-branch model**:

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production-ready code only | **GitHub Pages** (live site) |
| `develop` | Active development & integration | Nothing (staging/testing only) |

**`main` is protected.** Code reaches `main` only through reviewed pull requests from `develop`. Never commit or push directly to `main`.

---

## 2. Default Working Branch

**Always work from `develop`.** Before starting any task:

```
git checkout develop
git pull origin develop
```

If you are not on `develop`, switch to it first. Never begin work from `main`, a stale branch, or a detached HEAD.

---

## 3. The Pull-Before-Push Rule

**Every single time before pushing, pull first.** This is non-negotiable.

### For direct pushes to develop (small tasks):
```
git add .
git commit -m "<type>: <short description>"
git pull origin develop --rebase
# Resolve any conflicts if they appear
git push origin develop
```

### For feature branches:
```
git add .
git commit -m "<type>: <short description>"
git pull origin develop --rebase
git push origin <branch-name>
```

If `git pull --rebase` produces conflicts, **stop and resolve them carefully** before pushing. Never force-push to `develop` or `main`.

---

## 4. When to Use Feature Branches vs. Direct Commits

### Push directly to `develop` when:
- The change is small and self-contained (fixing a typo, updating text, adjusting a CSS value)
- It touches 1–3 files at most
- It can be described in a single commit message
- There is no risk of overlapping with someone else's work

### Use a feature branch when:
- The change spans multiple files or components
- It introduces new functionality or a new page/section
- It requires more than one commit to complete
- Multiple people might be working in the same area
- You want feedback before merging

### Creating a feature branch:
```
git checkout develop
git pull origin develop
git checkout -b <branch-name>
```

Branch naming conventions are defined in Section 7 below.

---

## 5. Merging to Main (Deployment)

Code moves from `develop` → `main` **only via pull request with at least one review**.

### Steps:
1. Ensure `develop` is stable and tested
2. Open a Pull Request: `develop` → `main`
3. Title the PR clearly (e.g., "Release: Add contact page and fix nav bugs")
4. At least one team member must review and approve
5. Use **"Squash and merge"** or **"Create a merge commit"** — never rebase onto main
6. After merge, GitHub Pages will automatically deploy from `main`

**Claude Code must never merge into `main` directly.** If asked to deploy or push to main, open a PR instead and inform the user that a review is required.

---

## 6. Commit Message Conventions

Every commit message must follow this format:

```
<type>: <short description in present tense>
```

### Types:
| Type | Use When |
|------|----------|
| `feat` | Adding new functionality or content |
| `fix` | Fixing a bug or broken behavior |
| `style` | Visual/CSS changes that don't affect logic |
| `refactor` | Restructuring code without changing behavior |
| `docs` | Updating README, comments, or documentation |
| `chore` | Config, dependencies, build tooling |
| `test` | Adding or updating tests |

### Examples:
```
feat: add team members section to about page
fix: correct broken image path on homepage
style: adjust header padding for mobile
docs: update README with setup instructions
chore: add .gitignore entry for node_modules
```

### Rules:
- Use lowercase, no period at the end
- Keep the description under 72 characters
- Use present tense ("add" not "added")
- One logical change per commit — don't bundle unrelated changes

---

## 7. Branch Naming Conventions

When creating feature branches, use this format:

```
<type>/<short-kebab-description>
```

### Examples:
```
feature/contact-page
fix/nav-mobile-overflow
style/dark-mode-theme
docs/api-usage-guide
chore/update-dependencies
```

### Rules:
- All lowercase
- Use hyphens, not underscores or spaces
- Keep it short but descriptive
- Prefix must match the type of work being done

---

## 8. Conflict Resolution

If a pull or rebase produces merge conflicts:

1. **Read the conflict markers carefully.** Understand what both sides changed.
2. **Preserve both changes when possible.** Don't blindly accept one side.
3. **If unsure, ask the user.** Say: "I found a merge conflict in `<file>`. Here's what both versions look like — which should I keep?"
4. After resolving, test that the file still works correctly.
5. Stage the resolved file and continue the rebase:
   ```
   git add <resolved-file>
   git rebase --continue
   ```

**Never use `--force` to push over conflicts.** Never silently drop someone else's work.

---

## 9. Safe Push Checklist

Before every push, confirm all of the following:

- [ ] You are on the correct branch (`develop` or a feature branch — **never** `main`)
- [ ] You have pulled the latest from `develop` with `--rebase`
- [ ] All merge conflicts (if any) are resolved
- [ ] Your commit messages follow the conventions in Section 6
- [ ] The code runs without errors (open `index.html` or run the dev server to verify if possible)
- [ ] You are not pushing anything sensitive (API keys, passwords, `.env` files)

---

## 10. GitHub Pages Configuration

- GitHub Pages is configured to serve from the **`main`** branch
- Only production-ready, reviewed code should exist on `main`
- The live site URL reflects what is on `main` — treat it as the public face of the project
- Never push experimental, broken, or in-progress work to `main`

---

## 11. Files to Never Commit

Ensure these are in `.gitignore` and never staged:

```
node_modules/
.env
.env.local
.DS_Store
Thumbs.db
*.log
dist/
.cache/
```

If you see any of these in a `git status`, do not add them. If they were accidentally committed previously, remove them:
```
git rm -r --cached node_modules/
```

---

## 12. General Rules for Claude Code

- **Ask before making destructive changes.** If a task involves deleting files, overwriting large sections, or restructuring directories, confirm with the user first.
- **Keep commits atomic.** Each commit should represent one logical change. Don't combine a bug fix with a new feature in the same commit.
- **Don't modify other people's in-progress branches** without explicit permission.
- **When in doubt, create a feature branch.** It's always safer to branch and PR than to push directly.
- **Always verify the working branch** at the start of every task by running `git branch` before doing anything else.
- **Communicate what you're doing.** Before pushing, summarize what you changed and why.
