const sharp = require("sharp");
const path = require("path");

const publicDir = path.resolve(__dirname, "../public");

async function main() {
  const leafSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<path d="M16 2C16 2 8 6 6 14C4 22 16 30 16 30C16 30 28 22 26 14C24 6 16 2 16 2Z" fill="#FF5A0A"/>' +
    '<path d="M16 2C16 2 12 8 12 16C12 20 14 24 16 30C18 24 20 20 20 16C20 8 16 2 16 2Z" fill="#FF7A1A"/>' +
    "</svg>";

  await sharp(Buffer.from(leafSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("Created apple-touch-icon.png (180x180)");

  const ogSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<rect width="1200" height="630" fill="#0B0F14"/>' +
    '<circle cx="600" cy="315" r="280" fill="none" stroke="rgba(255,90,10,0.08)" stroke-width="60"/>' +
    '<circle cx="600" cy="315" r="160" fill="none" stroke="rgba(255,90,10,0.12)" stroke-width="40"/>' +
    '<g transform="translate(560, 255) scale(4)">' +
    '<path d="M16 2C16 2 8 6 6 14C4 22 16 30 16 30C16 30 28 22 26 14C24 6 16 2 16 2Z" fill="#FF5A0A"/>' +
    '<path d="M16 2C16 2 12 8 12 16C12 20 14 24 16 30C18 24 20 20 20 16C20 8 16 2 16 2Z" fill="#FF7A1A"/>' +
    "</g>" +
    '<text x="600" y="380" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="bold">Adaptive Retrieval Intelligence Platform</text>' +
    '<text x="600" y="420" text-anchor="middle" fill="#999" font-family="sans-serif" font-size="16">kairos.dev</text>' +
    "</svg>";

  await sharp(Buffer.from(ogSvg))
    .resize(1200, 630)
    .png()
    .toFile(path.join(publicDir, "og-image.png"));
  console.log("Created og-image.png (1200x630)");
}

main().catch(console.error);
