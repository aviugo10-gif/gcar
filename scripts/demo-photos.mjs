// Placeholder car photos for demo mode only (clearly illustrations, not real stock).
import { writeFileSync } from "node:fs";
const cars = [
  ["mazda3", "#8E1B1B", "sedan"], ["corolla", "#D9DCE1", "sedan"], ["sportage", "#2E3A46", "suv"],
  ["i20", "#2F5DA8", "hatch"], ["octavia", "#55595F", "wagon"], ["tucson", "#F2F2F0", "suv"], ["niro", "#3F6B4F", "suv"], ["yaris", "#C9A227", "hatch"],
];
const body = {
  sedan: "M60 230 Q70 190 130 185 L210 140 Q240 125 300 125 L430 128 Q480 130 520 170 L600 185 Q640 192 645 230 L640 250 L70 250 Z",
  suv: "M60 235 Q62 180 120 170 L190 112 Q210 100 260 100 L470 102 Q510 104 540 150 L600 165 Q645 175 645 235 L640 255 L65 255 Z",
  hatch: "M70 235 Q75 190 135 182 L215 130 Q240 118 300 118 L450 122 Q500 126 525 175 L590 185 Q630 195 630 235 L625 252 L75 252 Z",
  wagon: "M55 232 Q62 188 125 182 L200 130 Q225 116 290 116 L560 120 Q600 124 615 175 L630 190 Q648 200 648 232 L642 252 L60 252 Z",
};
for (const [name, color, kind] of cars) {
  for (const v of [0, 1, 2]) {
    const bg = ["#ECEDEF", "#E4E6EA", "#F2F2F3"][v];
    const flip = v === 1 ? 'transform="translate(700 0) scale(-1 1)"' : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 525" width="1400" height="1050">
<rect width="700" height="525" fill="${bg}"/><rect y="330" width="700" height="195" fill="#D5D8DD"/>
<ellipse cx="350" cy="352" rx="300" ry="22" fill="#00000022"/>
<g ${flip} transform-origin="0 0"><g transform="translate(0 80)">
<path d="${body[kind]}" fill="${color}"/>
<path d="${body[kind]}" fill="url(#s)"/>
<path d="M230 140 L300 132 L300 175 L190 178 Z M320 132 L440 135 Q470 140 490 172 L320 175 Z" fill="#1B2027" opacity=".85" transform="${kind === "suv" ? "translate(0 -22)" : ""}"/>
<circle cx="180" cy="250" r="42" fill="#15181C"/><circle cx="180" cy="250" r="22" fill="#8A9099"/>
<circle cx="520" cy="250" r="42" fill="#15181C"/><circle cx="520" cy="250" r="22" fill="#8A9099"/>
</g></g>
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
<text x="20" y="505" font-family="sans-serif" font-size="14" fill="#5F6670">תמונה להמחשה</text>
</svg>`;
    writeFileSync(`public/demo/${name}-${v}.svg`, svg);
  }
}
console.log("ok");
