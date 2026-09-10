# Custom Directus image for production hosting (Zeabur): bakes in
# directus/extensions/restrict-email-domain so deployment doesn't depend on
# a local bind mount the way docker-compose.staging.yml does. Zeabur builds
# from the repo root by default (no CLI option to set a subdirectory), so
# this lives here rather than under directus/ — see .dockerignore for what's
# excluded from the build context. Rebuild/redeploy whenever a file under
# directus/extensions changes.
FROM directus/directus:11

COPY --chown=node:node directus/extensions /directus/extensions
