const sharp = require("sharp");
const path = require("path");

const publicDir = path.resolve(__dirname, "../public");

async function main() {
  const logoPath = path.join(publicDir, "branding/logos/kairos-dark.png");
  const meta = await sharp(logoPath).metadata();
  const sq = Math.min(meta.width, meta.height);
  const left = Math.round((meta.width - sq) / 2);
  const top = Math.round((meta.height - sq) / 2);

  await sharp(logoPath).resize(null, 28).png().toFile(path.join(publicDir, "branding/logos/kairos-nav.png"));
  console.log("Created branding/logos/kairos-nav.png");

  await sharp(logoPath).extract({ left, top, width: sq, height: sq }).resize(64, 64).png().toFile(path.join(publicDir, "branding/favicons/favicon.png"));
  console.log("Created branding/favicons/favicon.png");

  await sharp(logoPath).extract({ left, top, width: sq, height: sq }).resize(180, 180).png().toFile(path.join(publicDir, "branding/favicons/apple-touch-icon.png"));
  console.log("Created branding/favicons/apple-touch-icon.png");

  await sharp(logoPath).resize(null, 24).png().toFile(path.join(publicDir, "branding/logos/kairos-footer.png"));
  console.log("Created branding/logos/kairos-footer.png");

  const svgStr =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<rect width="1200" height="630" fill="#0B0F14"/>' +
    '<circle cx="600" cy="315" r="280" fill="none" stroke="rgba(255,90,10,0.08)" stroke-width="60"/>' +
    '<circle cx="600" cy="315" r="160" fill="none" stroke="rgba(255,90,10,0.12)" stroke-width="40"/>' +
    '<text x="600" y="390" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="bold">Adaptive Retrieval Intelligence Platform</text>' +
    '<text x="600" y="430" text-anchor="middle" fill="#999" font-family="sans-serif" font-size="16">kairos.dev</text>' +
    "</svg>";

  const ogBg = await sharp(Buffer.from(svgStr)).resize(1200, 630).png().toBuffer();
  const logoResized = await sharp(logoPath).resize(240, null).png().toBuffer();
  await sharp(ogBg).composite([{ input: logoResized, top: 200, left: 480 }]).png().toFile(path.join(publicDir, "branding/social/og-image.png"));
  console.log("Created branding/social/og-image.png");
}

main().catch(console.error);
