FROM hashicorp/vault:1.15

USER root

RUN if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache curl; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*; \
    elif command -v yum >/dev/null 2>&1; then \
      yum install -y curl && yum clean all; \
    else \
      echo "No supported package manager found to install curl" >&2; exit 1; \
    fi

# Keep paths stable with existing docker-compose service command.
RUN mkdir -p /vault /vault/shared
COPY infrastructure/vault/seed.sh /vault/seed.sh
COPY infrastructure/vault/bootstrap.sh /bootstrap.sh
RUN chmod +x /vault/seed.sh /bootstrap.sh

CMD ["/bootstrap.sh"]
