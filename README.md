# React + TypeScript + Vite

## Deploy no GitHub Pages

O projeto pode ser publicado como site estático no GitHub Pages. O workflow em `.github/workflows/deploy.yml` faz o build e o deploy automaticamente a cada push na branch `main`.

1. Faça push deste projeto para `https://github.com/theprogmatheus/theprog-editor`.
2. No GitHub, abra **Settings > Pages** e selecione **GitHub Actions** em **Build and deployment > Source**.
3. Execute o workflow novamente em **Actions > Deploy to GitHub Pages**, se necessário.

O endereço publicado será `https://theprogmatheus.github.io/theprog-editor/`.

O GitHub Pages não permite configurar os headers `COOP`/`COEP`. Por isso, a execução de C usa o fallback existente quando `SharedArrayBuffer` não está disponível; o restante do editor e do emulador continua sendo servido como aplicação estática.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
