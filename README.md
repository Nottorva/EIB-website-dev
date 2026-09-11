# EIB website

Two things live here, kept apart:

| Folder / file | What it is |
|---|---|
| `EIB platform spec.txt` | The architecture spec (roles, data model, stack, build order). |
| `EIB student manager.txt`, `Lesson editor.txt`, `Mentor CRM.txt`, `Student facing lesson view.txt` | The original reference UI mockups the app was built from. |
| `eib-platform/` | The app itself: one Next.js project containing all four tools and the public application form. Everything generated code-wise is in here and nowhere else. |

To run the app:

```
cd eib-platform
npm install
npm run dev
```

Then open http://localhost:3000. See `eib-platform/README.md` for the click-through guide, layout, and the list of deliberate deviations from the spec.
