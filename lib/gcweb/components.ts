/**
 * Component palette catalog.
 *
 * Each entry is a draggable / clickable GCWeb pattern with canonical HTML.
 * The `html` fields are copy-pasted from the gc-component-mapping skill,
 * so they match exactly what the LLM would produce for the same component
 * name. This matters — it means hand-dropped components and Claude-generated
 * ones are structurally identical, so edits, diffing, and Figma round-trips
 * all work without special cases.
 *
 * Placeholder content is short and generic on purpose. The user fills in
 * real copy via chat or direct edit after insertion. A later upgrade can
 * fire an auto-fill chat turn right after insertion if we want Claude to
 * seed realistic text.
 *
 * Extending the palette: add a new entry to COMPONENTS. No other code
 * needs to change.
 */

export type ComponentCategory =
  | "Callouts"
  | "Layout"
  | "Content"
  | "Interactive";

export interface PaletteComponent {
  id: string;
  label: string;
  category: ComponentCategory;
  /** Single-line description shown in the palette card. */
  description: string;
  /** Canonical HTML. Must be a single root element so insertion is clean. */
  html: string;
}

export const COMPONENTS: PaletteComponent[] = [
  // ------------------- CALLOUTS -------------------
  {
    id: "alert-info",
    label: "Alert — info",
    category: "Callouts",
    description: "Blue informational callout. Neutral notice, no urgency.",
    html: `<section class="alert alert-info">
  <h3>Information</h3>
  <p>Information content. Replace this with the message you want to convey.</p>
</section>`,
  },
  {
    id: "alert-warning",
    label: "Alert — warning",
    category: "Callouts",
    description: "Yellow warning. Heads-up about something the user should know.",
    html: `<section class="alert alert-warning">
  <h3>Warning</h3>
  <p>Warning content. Replace this with what the user needs to be cautious about.</p>
</section>`,
  },
  {
    id: "alert-danger",
    label: "Alert — danger",
    category: "Callouts",
    description: "Red error/important. Reserve for blocking issues.",
    html: `<section class="alert alert-danger">
  <h3>Important</h3>
  <p>Error or blocking condition. Replace this with what is wrong or blocked.</p>
</section>`,
  },
  {
    id: "alert-success",
    label: "Alert — success",
    category: "Callouts",
    description: "Green confirmation. Positive outcome or completed action.",
    html: `<section class="alert alert-success">
  <h3>Success</h3>
  <p>Positive confirmation. Replace this with what has been completed.</p>
</section>`,
  },
  {
    id: "well",
    label: "Well (grey aside)",
    category: "Callouts",
    description: "Grey-background box for secondary / aside content.",
    html: `<div class="well">
  <h3>Aside heading</h3>
  <p>Supporting or secondary information. Use sparingly to highlight a block without the weight of an alert.</p>
</div>`,
  },

  // ------------------- LAYOUT -------------------
  {
    id: "feature-cards",
    label: "Feature cards (3-up)",
    category: "Layout",
    description: "Equal-height grid of three feature cards with image + link.",
    html: `<section class="gc-features">
  <h2>Features</h2>
  <div class="row wb-eqht-grd">
    <div class="col-lg-4 col-sm-6">
      <div class="well well-sm eqht-trgt">
        <img src="https://placehold.co/400x250?text=Feature+one" alt="Feature one" class="img-responsive">
        <h3><a href="#">Feature one</a></h3>
        <p>Short description of the first feature.</p>
      </div>
    </div>
    <div class="col-lg-4 col-sm-6">
      <div class="well well-sm eqht-trgt">
        <img src="https://placehold.co/400x250?text=Feature+two" alt="Feature two" class="img-responsive">
        <h3><a href="#">Feature two</a></h3>
        <p>Short description of the second feature.</p>
      </div>
    </div>
    <div class="col-lg-4 col-sm-6">
      <div class="well well-sm eqht-trgt">
        <img src="https://placehold.co/400x250?text=Feature+three" alt="Feature three" class="img-responsive">
        <h3><a href="#">Feature three</a></h3>
        <p>Short description of the third feature.</p>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: "most-requested",
    label: "Most requested",
    category: "Layout",
    description: "Two-column list of top links. The Canada.ca topic-page staple.",
    html: `<section class="gc-mstrqst">
  <h2>Most requested</h2>
  <ul class="colcount-md-2">
    <li><a href="#">Most requested link one</a></li>
    <li><a href="#">Most requested link two</a></li>
    <li><a href="#">Most requested link three</a></li>
    <li><a href="#">Most requested link four</a></li>
    <li><a href="#">Most requested link five</a></li>
    <li><a href="#">Most requested link six</a></li>
  </ul>
</section>`,
  },
  {
    id: "services-benefits",
    label: "Services and information",
    category: "Layout",
    description: "Two-column doormat: heading + one-line description per link.",
    html: `<section class="gc-srvinfo">
  <h2>Services and information</h2>
  <div class="row">
    <div class="col-md-6">
      <h3><a href="#">Service one</a></h3>
      <p>One-line description of what the user gets from this link.</p>
    </div>
    <div class="col-md-6">
      <h3><a href="#">Service two</a></h3>
      <p>One-line description of what the user gets from this link.</p>
    </div>
    <div class="col-md-6">
      <h3><a href="#">Service three</a></h3>
      <p>One-line description of what the user gets from this link.</p>
    </div>
    <div class="col-md-6">
      <h3><a href="#">Service four</a></h3>
      <p>One-line description of what the user gets from this link.</p>
    </div>
  </div>
</section>`,
  },

  // ------------------- CONTENT -------------------
  {
    id: "steps",
    label: "Steps (numbered)",
    category: "Content",
    description: "Ordered list styled as a step-by-step process.",
    html: `<section>
  <h2>Steps</h2>
  <ol class="lst-steps">
    <li>
      <h3>Step one</h3>
      <p>What the user does first.</p>
    </li>
    <li>
      <h3>Step two</h3>
      <p>What the user does next.</p>
    </li>
    <li>
      <h3>Step three</h3>
      <p>How the user finishes.</p>
    </li>
  </ol>
</section>`,
  },
  {
    id: "blockquote",
    label: "Pull quote",
    category: "Content",
    description: "Emphasized quote or testimonial with attribution.",
    html: `<blockquote class="mrgn-tp-lg mrgn-bttm-lg">
  <p>A memorable quote or testimonial that highlights something important about this service.</p>
  <footer class="text-muted">— Attribution, Title or organization</footer>
</blockquote>`,
  },
  {
    id: "stat-row",
    label: "Stat row (3-up)",
    category: "Content",
    description: "Three big numbers with labels. Good for impact stats.",
    html: `<section class="gc-stats mrgn-tp-lg mrgn-bttm-lg">
  <h2 class="wb-inv">Key statistics</h2>
  <div class="row text-center">
    <div class="col-md-4">
      <p class="mrgn-bttm-0" style="font-size: 3rem; font-weight: 700; color: #335075;">1.2M</p>
      <p class="mrgn-tp-0">Applications processed</p>
    </div>
    <div class="col-md-4">
      <p class="mrgn-bttm-0" style="font-size: 3rem; font-weight: 700; color: #335075;">97%</p>
      <p class="mrgn-tp-0">Satisfaction rate</p>
    </div>
    <div class="col-md-4">
      <p class="mrgn-bttm-0" style="font-size: 3rem; font-weight: 700; color: #335075;">$2.4B</p>
      <p class="mrgn-tp-0">Benefits delivered</p>
    </div>
  </div>
</section>`,
  },
  {
    id: "timeline",
    label: "Timeline",
    category: "Content",
    description: "Ordered list of dated milestones.",
    html: `<section>
  <h2>Timeline</h2>
  <ol class="lst-none pddng-lft-0">
    <li class="mrgn-bttm-md">
      <p class="text-muted mrgn-bttm-0"><time datetime="2024-01-15"><strong>January 2024</strong></time></p>
      <h3 class="mrgn-tp-0">Milestone one</h3>
      <p>What happened at this point in the process.</p>
    </li>
    <li class="mrgn-bttm-md">
      <p class="text-muted mrgn-bttm-0"><time datetime="2024-04-01"><strong>April 2024</strong></time></p>
      <h3 class="mrgn-tp-0">Milestone two</h3>
      <p>What happened next.</p>
    </li>
    <li>
      <p class="text-muted mrgn-bttm-0"><time datetime="2024-07-20"><strong>July 2024</strong></time></p>
      <h3 class="mrgn-tp-0">Milestone three</h3>
      <p>Most recent event.</p>
    </li>
  </ol>
</section>`,
  },
  {
    id: "news-list",
    label: "News list",
    category: "Content",
    description: "Reverse-chronological news items with dates and teasers.",
    html: `<section>
  <h2>Latest news</h2>
  <ul class="list-unstyled lst-spcd">
    <li class="mrgn-bttm-md">
      <p class="small text-muted mrgn-bttm-0"><time datetime="2024-04-20">April 20, 2024</time></p>
      <h3 class="mrgn-tp-0"><a href="#">News item headline one</a></h3>
      <p>Short teaser paragraph describing the news item.</p>
    </li>
    <li class="mrgn-bttm-md">
      <p class="small text-muted mrgn-bttm-0"><time datetime="2024-04-15">April 15, 2024</time></p>
      <h3 class="mrgn-tp-0"><a href="#">News item headline two</a></h3>
      <p>Short teaser paragraph describing the news item.</p>
    </li>
    <li>
      <p class="small text-muted mrgn-bttm-0"><time datetime="2024-04-10">April 10, 2024</time></p>
      <h3 class="mrgn-tp-0"><a href="#">News item headline three</a></h3>
      <p>Short teaser paragraph describing the news item.</p>
    </li>
  </ul>
</section>`,
  },

  // ------------------- More LAYOUT -------------------
  {
    id: "image-promo",
    label: "Image + text promo",
    category: "Layout",
    description: "50/50 split — image on the left, heading + copy + CTA right.",
    html: `<section class="mrgn-tp-lg mrgn-bttm-lg">
  <div class="row">
    <div class="col-md-6">
      <img src="https://placehold.co/600x400?text=Promo+image" alt="Promo image placeholder" class="img-responsive">
    </div>
    <div class="col-md-6">
      <h2>Section heading</h2>
      <p>A brief paragraph describing the benefit or action. Explain what users get and why they should care.</p>
      <p><a class="btn btn-default" href="#">Learn more</a></p>
    </div>
  </div>
</section>`,
  },
  {
    id: "icon-grid",
    label: "Icon grid (4-up)",
    category: "Layout",
    description: "Four topic tiles with glyphicon icons, headings, and links.",
    html: `<section class="mrgn-tp-lg mrgn-bttm-lg">
  <h2>Browse by topic</h2>
  <div class="row wb-eqht-grd">
    <div class="col-sm-6 col-md-3 text-center mrgn-bttm-md">
      <p class="mrgn-bttm-sm"><span class="glyphicon glyphicon-file" aria-hidden="true" style="font-size: 3rem; color: #335075;"></span></p>
      <h3 class="h5"><a href="#">Topic one</a></h3>
      <p>Short description of this topic.</p>
    </div>
    <div class="col-sm-6 col-md-3 text-center mrgn-bttm-md">
      <p class="mrgn-bttm-sm"><span class="glyphicon glyphicon-user" aria-hidden="true" style="font-size: 3rem; color: #335075;"></span></p>
      <h3 class="h5"><a href="#">Topic two</a></h3>
      <p>Short description of this topic.</p>
    </div>
    <div class="col-sm-6 col-md-3 text-center mrgn-bttm-md">
      <p class="mrgn-bttm-sm"><span class="glyphicon glyphicon-cog" aria-hidden="true" style="font-size: 3rem; color: #335075;"></span></p>
      <h3 class="h5"><a href="#">Topic three</a></h3>
      <p>Short description of this topic.</p>
    </div>
    <div class="col-sm-6 col-md-3 text-center mrgn-bttm-md">
      <p class="mrgn-bttm-sm"><span class="glyphicon glyphicon-envelope" aria-hidden="true" style="font-size: 3rem; color: #335075;"></span></p>
      <h3 class="h5"><a href="#">Topic four</a></h3>
      <p>Short description of this topic.</p>
    </div>
  </div>
</section>`,
  },

  // ------------------- More CALLOUTS -------------------
  {
    id: "cta-band",
    label: "CTA band (full-width)",
    category: "Callouts",
    description: "Full-width coloured band with heading and button. Big push.",
    html: `<section class="well well-lg text-center mrgn-tp-lg mrgn-bttm-lg" style="background-color: #335075; color: #fff;">
  <h2 class="h1 mrgn-tp-0" style="color: #fff;">Ready to get started?</h2>
  <p>One short sentence that explains why users should take the action.</p>
  <p class="mrgn-bttm-0"><a href="#" class="btn btn-default btn-lg">Take action now</a></p>
</section>`,
  },

  // ------------------- INTERACTIVE -------------------
  {
    id: "accordion",
    label: "Accordion (FAQ)",
    category: "Interactive",
    description: "Native <details>/<summary>. GCWeb styles them as accordions.",
    html: `<section>
  <h2>Frequently asked questions</h2>
  <details>
    <summary>First question goes here?</summary>
    <p>The answer to the first question. Keep it short and useful.</p>
  </details>
  <details>
    <summary>Second question goes here?</summary>
    <p>The answer to the second question.</p>
  </details>
  <details>
    <summary>Third question goes here?</summary>
    <p>The answer to the third question.</p>
  </details>
</section>`,
  },
  {
    id: "tabs",
    label: "Tabs (wb-tabs)",
    category: "Interactive",
    description: "Desktop tabs, mobile accordion — GCWeb's adaptive pattern.",
    html: `<section>
  <h2 class="wb-inv">Tabbed content</h2>
  <div class="wb-tabs">
    <div class="tabpanels">
      <details id="tab-one" open="open">
        <summary>Tab one</summary>
        <p>Content for the first tab. Replace with your own text.</p>
      </details>
      <details id="tab-two">
        <summary>Tab two</summary>
        <p>Content for the second tab.</p>
      </details>
      <details id="tab-three">
        <summary>Tab three</summary>
        <p>Content for the third tab.</p>
      </details>
    </div>
  </div>
</section>`,
  },
  {
    id: "cta-button",
    label: "Call-to-action button",
    category: "Interactive",
    description: "Primary call-to-action button. One per page, near the top.",
    html: `<p class="mrgn-tp-lg">
  <a href="#" class="btn btn-call-to-action">Action label</a>
</p>`,
  },
];

/** Group components by category, preserving the order they appear in COMPONENTS. */
export function groupByCategory(): Record<ComponentCategory, PaletteComponent[]> {
  const grouped: Record<ComponentCategory, PaletteComponent[]> = {
    Callouts: [],
    Layout: [],
    Content: [],
    Interactive: [],
  };
  for (const c of COMPONENTS) {
    grouped[c.category].push(c);
  }
  return grouped;
}
