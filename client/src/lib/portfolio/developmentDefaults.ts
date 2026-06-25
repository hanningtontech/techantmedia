import type { DevelopmentSettings } from "./portfolioTypes";

export const DEFAULT_DEVELOPMENT_SETTINGS: DevelopmentSettings = {
  heroEyebrow: "Engineering",
  heroTitle: "Full-Stack Development",
  heroSubtitle:
    "Web apps, admin dashboards, payments, and APIs—shipped with clean UX and reliable infrastructure.",
  storyTitle: "My Story",
  storyParagraphs: [
    "My name is Hannington Njuguna, and I am a full-stack developer driven by innovation and a passion for user-centric design. My development journey took root in 2021, where I dove into Android mobile development using Java. Over time, I mastered Kotlin, expanding my ability to craft intuitive, high-performance apps. Alongside a team of talented peers, I co-developed the Maasai Mara University app, a vibrant platform connecting students to galleries, campus amenities, and peer networks.",
    "As I grew, so did my toolkit. Beyond mobile, I ventured into web development, mastering front-end technologies like React, CSS, and JavaScript, paired with robust back-end solutions in PHP and Node.js. I designed and optimized e-commerce websites, including a pivotal project for Xiaomi Store Kenya, where I enhanced their website's SEO and modernized its user interface.",
    "My back-end expertise spans MySQL and Firebase, but I'm particularly drawn to NoSQL databases like MongoDB, which I leverage for scalable, dynamic applications. As the tech landscape evolved, so did I—embracing AI to embed intelligent agents and chatbots into both mobile and web apps. These AI systems allow users to interact naturally with apps, reducing reliance on human support and making experiences more intuitive.",
    "Today, AI is a core pillar of my workflow, drastically reducing development time from months to weeks. Yet, as my reach extends, so does my responsibility. I now focus deeply on cybersecurity, ensuring that every app I build is fortified against emerging threats. By continuously learning and evolving, I don't just build software—I build trust, security, and a future where technology empowers everyone.",
  ],
  cvSectionTitle: "My General CV",
  cvDescription:
    "Download my full developer CV — experience, selected projects, photography & videography, education, and technical focus areas.",
  cvDownloadUrl: "",
  cvFileName: "Hannington_Kuria_Njuguna_Developer_CV.pdf",
};

/** Join paragraphs for the admin textarea (blank line between paragraphs). */
export function storyParagraphsToText(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

/** Split admin textarea into paragraphs (blank line separated). */
export function textToStoryParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
