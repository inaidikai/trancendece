FROM alpine:3.20

RUN apk add --no-cache ca-certificates curl

# Keep paths stable with existing docker-compose service command.
RUN mkdir -p /vault /vault/shared
COPY infrastructure/vault/seed.sh /vault/seed.sh
COPY infrastructure/vault/bootstrap.sh /bootstrap.sh
RUN chmod +x /vault/seed.sh /bootstrap.sh

CMD ["/bootstrap.sh"]

