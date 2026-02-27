**Commit Message Guidelines for Sayari Project**

To ensure consistency, clarity, and meaningful history in version control, follow these commit message guidelines when working on the Sayari School Management System.

---

### ✨ Commit Format

Use the following format for each commit:

```
<type>(<scope>): <short, imperative summary>

<optional longer description>
```

---

### ✏ Types

Use one of the following types:

| Type       | Description                                |
| ---------- | ------------------------------------------ |
| `feat`     | A new feature                              |
| `fix`      | A bug fix                                  |
| `refactor` | Code improvement without functional change |
| `style`    | CSS, formatting, or UI-only changes        |
| `docs`     | Documentation updates                      |
| `test`     | Adding or updating tests                   |
| `chore`    | Maintenance or tooling changes             |

---

### 🌐 Scope

Use the scope to indicate where the change applies. Some examples:

- `auth` (sign in / sign up)
- `ui` (general UI or styles)
- `form` (form logic)
- `dashboard` (dashboard functionality)
- `api` (backend communication)
- `helpers` (helper utilities)
- `component` (reusable components like dropdowns)

---

### ✅ Examples

```
feat(ui): add reusable customSelect component for dropdowns
```

```
fix(auth): show error on invalid login credentials
```

```
refactor(form): extract region and district loading to helper
```

```
docs: add commit message guidelines to documentation
```

---

### ⬆️ Best Practices

- Use imperative mood ("Add" not "Added" or "Adds")
- Keep the summary under 72 characters
- Add a longer description when the commit is complex
- Group related changes together in a single commit
- Avoid committing multiple unrelated features or fixes together

---

Following this guide will make collaboration smoother and the project easier to maintain. Happy committing ✨

