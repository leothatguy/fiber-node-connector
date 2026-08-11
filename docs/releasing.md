# Releasing

The release workflow publishes Linux `amd64` and `arm64` images to GitHub Container Registry. Branch pushes and pull requests only test the project and build the image locally.

## Repository setup

1. Create a public GitHub repository and push this project.
2. Keep Actions enabled with read and write workflow permissions for packages.
3. No registry password is required. The workflow authenticates with the repository `GITHUB_TOKEN`.

The image name is derived from the repository:

```text
ghcr.io/<owner>/<repository>:<tag>
```

## Publish a release

Create and push a semantic-version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow runs the test suite, builds both architectures, generates provenance and an SBOM, then publishes `0.1.0`, `0.1`, and `latest` tags.

After the first publication, open the package settings on GitHub and set the package visibility to Public if it did not inherit public visibility from the repository. This is a one-time package setting.

Manual workflow runs publish an `edge` tag and are intended for pre-release verification.
