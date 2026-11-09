# dNaViT project website

Website: https://lixiaotong97.github.io/dNaViT/

This public repository contains only the project website and its display assets.
It is separate from the private model and training-code repository.

## Update the website

Edit `dNaViT/index.html` and add, replace, or remove files in `dNaViT/assets/`.
Update any references when deleting or renaming assets. Commit and push to `main`:

```sh
git add -A dNaViT
git commit -m "Update dNaViT project website"
git push origin main
```

GitHub Pages publishes the root of `main`. The `.nojekyll` file keeps the site
buildless. Each push triggers a new deployment; check the Actions tab for status.
Files can also be edited, uploaded, or deleted through GitHub's web interface.
The current publication is stored as a single snapshot commit. Future updates
can use ordinary commits to review changes and revert mistakes.

Do not commit credentials, service logs, backups, or private training files.
Everything tracked in this repository is public, including its Git history.
