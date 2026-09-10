# Custom Directus image for production hosting (e.g. Zeabur): bakes in
# extensions/restrict-email-domain so deployment doesn't depend on a local
# bind mount the way docker-compose.staging.yml does. Rebuild and redeploy
# this image whenever a file under extensions/ changes.
FROM directus/directus:11

COPY --chown=node:node extensions /directus/extensions
