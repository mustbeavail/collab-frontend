# ── build stage ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* 는 빌드 시점에 번들에 인라인되므로 build-arg로 주입
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_KAKAO_MAP_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_KAKAO_MAP_KEY=$NEXT_PUBLIC_KAKAO_MAP_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── run stage (standalone) ──────────────────────────────────
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 보안: 비-root(node) 유저로 실행 -> RCE 발생해도 컨테이너 내 root 획득 방지.
# standalone 산출물을 node 소유로 복사(런타임 .next/cache 쓰기 위함).
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node","server.js"]
