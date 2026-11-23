/** @type {import('next').NextConfig} */
const nextConfig = {
  // Credential pages (/c/<id>) are public to anyone holding the link, and
  // must never be listed by a search engine.
  async headers() {
    return [{ source: "/c/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};
export default nextConfig;
