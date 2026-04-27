/**
 * Component palette catalog.
 *
 * Each entry is a click-to-insert GCWeb pattern with canonical HTML.
 * The HTML here is what gets dropped into <main> when the user picks
 * the card; it should match what Claude generates for the same pattern
 * so edits, diffs, and Figma round-trips work without special cases.
 *
 * Catalogue philosophy: one canonical version of each pattern. Variants
 * (alert colours, button styles, …) are best handled via a follow-up
 * chat turn ("change this alert to a warning") rather than 4 cards in
 * the palette. Keeps the palette small and the muscle memory simple.
 *
 * Méli-mélo notes: a few patterns (and/or conjunction, numbered steps)
 * use experimental méli-mélo classes (cnjnctn-type-or, lst-stps). The
 * shell loads the méli-mélo CSS so these render correctly.
 *
 * Bands: marked with .gc-band (and usually .well too, for padding). The
 * shell CSS rule on `main.container > .gc-band` makes them break out of
 * the container and span the viewport via negative margins.
 */

export type ComponentCategory =
  | "Callouts"
  | "Navigation"
  | "Content"
  | "Forms";

export interface PaletteComponent {
  id: string;
  label: string;
  category: ComponentCategory;
  description: string;
  html: string;
}

export const COMPONENTS: PaletteComponent[] = [
  {
    id: "alert",
    label: "Alert",
    category: "Callouts",
    description: "Highlighted callout box. Switch variant via chat.",
    html: `<section class="alert alert-info">
  <h2>Heading</h2>
  <p>Alert message. Replace with the information you need to highlight.</p>
</section>`,
  },
  {
    id: "and-or",
    label: "And / Or pattern",
    category: "Callouts",
    description:
      "Méli-mélo conjunction (cnjnctn-type-or). Swap class to cnjnctn-type-and for the AND variant.",
    html: `<section>
  <h3>Eligibility</h3>
  <p>You qualify if any of the following applies:</p>
  <ul class="cnjnctn-type-or">
    <li class="cnjnctn-col">
      <h4>Header A<span class="wb-inv">: Option 1 of 2</span></h4>
      <p>Content for option A.</p>
    </li>
    <li class="cnjnctn-col">
      <h4>Header B<span class="wb-inv">: Option 2 of 2</span></h4>
      <p>Content for option B.</p>
    </li>
  </ul>
</section>`,
  },
  {
    id: "band",
    label: "Band",
    category: "Callouts",
    description:
      "Full-width grey band. The .gc-band marker keeps it full-width even if you ask to change its colour.",
    html: `<section class="gc-band well brdr-0 brdr-rds-0 no-box-shadow mrgn-bttm-0">
  <div class="container mrgn-tp-md mrgn-bttm-md">
    <h2 class="mrgn-tp-0">Section heading</h2>
    <p>Band content. The 'well' class paints this section grey; '.gc-band' is the marker the shell's CSS uses to make it break out of <code>main.container</code> and span the viewport.</p>
  </div>
</section>`,
  },
  {
    id: "band-light-blue",
    label: "Band — light blue",
    category: "Callouts",
    description:
      "Full-width light-blue band. Keeps .well for padding; inline background-color overrides .well's grey.",
    html: `<section class="gc-band well brdr-0 brdr-rds-0 no-box-shadow mrgn-bttm-0" style="background-color: #d7e6f3;">
  <div class="container mrgn-tp-md mrgn-bttm-md">
    <h2 class="mrgn-tp-0">Section heading</h2>
    <p>Light-blue band content. The '.well' class preserves vertical padding so margin-collapse from the inner container doesn't eat the band's height; the inline <code>background-color</code> overrides .well's default grey.</p>
  </div>
</section>`,
  },
  {
    id: "most-requested",
    label: "Most requested",
    category: "Callouts",
    description:
      "Topic-page Most-requested band — heading on the left, link list on the right.",
    html: `<section class="gc-band provisional gc-most-requested">
  <div class="container">
    <div class="row d-sm-flex flex-sm-wrap">
      <div class="col-md-2 d-flex align-self-center">
        <h2>Most requested</h2>
      </div>
      <div class="col-md-10 d-flex align-self-center">
        <ul>
          <li><a href="#">Most-requested item 1</a></li>
          <li><a href="#">Most-requested item 2</a></li>
          <li><a href="#">Most-requested item 3</a></li>
          <li><a href="#">Most-requested item 4</a></li>
        </ul>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: "on-this-page",
    label: "On this page",
    category: "Navigation",
    description: "In-page table of contents — always an unordered list.",
    html: `<section>
  <h2>On this page</h2>
  <ul>
    <li><a href="#section-1">Section 1</a></li>
    <li><a href="#section-2">Section 2</a></li>
    <li><a href="#section-3">Section 3</a></li>
  </ul>
</section>`,
  },
  {
    id: "doormats",
    label: "Doormats",
    category: "Navigation",
    description: "Topic-page navigation — title + short description per link.",
    html: `<section>
  <h2 class="wb-inv">Services and information</h2>
  <ul class="list-unstyled colcount-md-2 lst-spcd-2 mrgn-tp-lg">
    <li>
      <h3 class="h5"><a href="#">Doormat title</a></h3>
      <p>Short description of what's behind this link.</p>
    </li>
    <li>
      <h3 class="h5"><a href="#">Doormat title</a></h3>
      <p>Short description of what's behind this link.</p>
    </li>
    <li>
      <h3 class="h5"><a href="#">Doormat title</a></h3>
      <p>Short description of what's behind this link.</p>
    </li>
    <li>
      <h3 class="h5"><a href="#">Doormat title</a></h3>
      <p>Short description of what's behind this link.</p>
    </li>
  </ul>
</section>`,
  },
  {
    id: "tabs",
    label: "Tabs",
    category: "Navigation",
    description: "Tabbed sections via WET-BOEW wb-tabs.",
    html: `<div class="wb-tabs">
  <div class="tabpanels">
    <details id="tab-1" open="open">
      <summary>Tab 1</summary>
      <p>Content of tab 1.</p>
    </details>
    <details id="tab-2">
      <summary>Tab 2</summary>
      <p>Content of tab 2.</p>
    </details>
    <details id="tab-3">
      <summary>Tab 3</summary>
      <p>Content of tab 3.</p>
    </details>
  </div>
</div>`,
  },
  {
    id: "context-features",
    label: "Context-specific features",
    category: "Content",
    description: "Services and information — feature links in a 2-column grid.",
    html: `<section>
  <h2>Services and information</h2>
  <ul class="list-unstyled colcount-md-2 mrgn-tp-lg">
    <li class="mrgn-bttm-lg">
      <h3 class="h5"><a href="#">Feature title</a></h3>
      <p>Short description of the feature.</p>
    </li>
    <li class="mrgn-bttm-lg">
      <h3 class="h5"><a href="#">Feature title</a></h3>
      <p>Short description of the feature.</p>
    </li>
    <li class="mrgn-bttm-lg">
      <h3 class="h5"><a href="#">Feature title</a></h3>
      <p>Short description of the feature.</p>
    </li>
    <li class="mrgn-bttm-lg">
      <h3 class="h5"><a href="#">Feature title</a></h3>
      <p>Short description of the feature.</p>
    </li>
  </ul>
</section>`,
  },
  {
    id: "list-steps",
    label: "Numbered steps",
    category: "Content",
    description: "Méli-mélo step list (lst-stps) — link + short summary per step.",
    html: `<ol class="lst-stps">
  <li>
    <h4><a href="#">Topic or task hyperlink for step 1</a></h4>
    <p>Use action verbs or short keywords summarizing what the user does or finds at this step.</p>
  </li>
  <li>
    <h4><a href="#">Topic or task hyperlink for step 2</a></h4>
    <p>Use action verbs or short keywords summarizing what the user does or finds at this step.</p>
  </li>
  <li>
    <h4><a href="#">Topic or task hyperlink for step 3</a></h4>
    <p>Use action verbs or short keywords summarizing what the user does or finds at this step.</p>
  </li>
</ol>`,
  },
  {
    id: "well",
    label: "Well (inline callout)",
    category: "Content",
    description: "Bootstrap well — inline grey callout box for asides. Not full-width.",
    html: `<aside class="well">
  <h2 class="mrgn-tp-0">Heading</h2>
  <p>Well content. Used for small inline asides — definitions, tips, secondary info — that should stand out without becoming a full band.</p>
</aside>`,
  },
  {
    id: "panel",
    label: "Panel",
    category: "Content",
    description: "Bootstrap panel — bordered box with optional heading and body.",
    html: `<section class="panel panel-default">
  <header class="panel-heading">
    <h2 class="panel-title">Panel heading</h2>
  </header>
  <div class="panel-body">
    <p>Panel body content. Use for grouped information that needs a clear visual frame, such as a summary box or sidebar block.</p>
  </div>
</section>`,
  },
  {
    id: "image",
    label: "Image",
    category: "Content",
    description: "Responsive image with optional caption.",
    html: `<figure class="mrgn-bttm-md">
  <img src="https://placehold.co/800x400" alt="Describe the image" class="img-responsive">
  <figcaption>Caption text describing the image.</figcaption>
</figure>`,
  },
  {
    id: "multimedia",
    label: "Multimedia",
    category: "Content",
    description: "Video player with caption — replace src with your media URL.",
    html: `<figure class="mrgn-bttm-md">
  <video controls class="img-responsive">
    <source src="video.mp4" type="video/mp4">
    Your browser does not support the video element.
  </video>
  <figcaption>Video description.</figcaption>
</figure>`,
  },
  {
    id: "table",
    label: "Table",
    category: "Content",
    description: "Basic GCWeb data table with caption and column headers.",
    html: `<table class="table">
  <caption>Describe the table contents</caption>
  <thead>
    <tr>
      <th scope="col">Column 1</th>
      <th scope="col">Column 2</th>
      <th scope="col">Column 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cell</td>
      <td>Cell</td>
      <td>Cell</td>
    </tr>
    <tr>
      <td>Cell</td>
      <td>Cell</td>
      <td>Cell</td>
    </tr>
  </tbody>
</table>`,
  },
  {
    id: "expand-collapse",
    label: "Expand-collapse",
    category: "Content",
    description: "Disclosure widget via native <details>/<summary>.",
    html: `<details>
  <summary>Heading</summary>
  <p>Content revealed when the user expands the section.</p>
</details>`,
  },
  {
    id: "button",
    label: "Button",
    category: "Forms",
    description: "Primary call-to-action button.",
    html: `<p class="mrgn-tp-lg">
  <a href="#" class="btn btn-call-to-action">Action label</a>
</p>`,
  },
  {
    id: "radio-group",
    label: "Radio buttons (large)",
    category: "Forms",
    description: "Grouped radio buttons via gc-chckbxrdio — one selection.",
    html: `<fieldset class="gc-chckbxrdio">
  <legend>Question text</legend>
  <ul class="list-unstyled lst-spcd-2">
    <li class="radio">
      <input type="radio" name="opt" id="opt-1">
      <label for="opt-1">Option 1</label>
    </li>
    <li class="radio">
      <input type="radio" name="opt" id="opt-2">
      <label for="opt-2">Option 2</label>
    </li>
    <li class="radio">
      <input type="radio" name="opt" id="opt-3">
      <label for="opt-3">Option 3</label>
    </li>
  </ul>
</fieldset>`,
  },
  {
    id: "checkbox-group",
    label: "Checkboxes (large)",
    category: "Forms",
    description: "Grouped checkboxes via gc-chckbxrdio — multiple selections allowed.",
    html: `<fieldset class="gc-chckbxrdio">
  <legend>Question text</legend>
  <ul class="list-unstyled lst-spcd-2">
    <li class="checkbox">
      <input type="checkbox" id="chk-1">
      <label for="chk-1">Option 1</label>
    </li>
    <li class="checkbox">
      <input type="checkbox" id="chk-2">
      <label for="chk-2">Option 2</label>
    </li>
    <li class="checkbox">
      <input type="checkbox" id="chk-3">
      <label for="chk-3">Option 3</label>
    </li>
  </ul>
</fieldset>`,
  },
  {
    id: "field-flow",
    label: "Field flow (wizard)",
    category: "Forms",
    description:
      "WET-BOEW wb-fieldflow — interactive wizard with nested follow-ups and conditional results.",
    html: `<div class="wb-frmvld" id="ff">
  <form method="get">
    <div class="wb-fieldflow gc-font-2019" data-wb-fieldflow='{
      "noForm": true,
      "renderas": "radio",
      "gcChckbxrdio": true,
      "base": { "live": true, "renderas": "radio", "gcChckbxrdio": true },
      "default": { "action": "addClass", "source": ".result", "class": "hidden" },
      "reset": { "action": "addClass", "source": ".result", "class": "hidden" }
    }'>
      <p>Replace with your first question.</p>
      <ul>
        <li>Option that has a follow-up
          <div class="wb-fieldflow-sub">
            <p>Replace with the follow-up question.</p>
            <ul>
              <li data-wb-fieldflow='{"action": "removeClass", "class": "hidden", "source": "#ff-result-a"}'>Sub-option leading to result A</li>
              <li data-wb-fieldflow='{"action": "removeClass", "class": "hidden", "source": "#ff-result-b"}'>Sub-option leading to result B</li>
            </ul>
          </div>
        </li>
        <li data-wb-fieldflow='{"action": "removeClass", "class": "hidden", "source": "#ff-result-c"}'>Option that goes straight to result C</li>
      </ul>
    </div>
  </form>
  <div id="ff-result-a" class="hidden result">
    <p><strong>Result A</strong> — replace with the guidance shown when the user reaches this leaf.</p>
  </div>
  <div id="ff-result-b" class="hidden result">
    <p><strong>Result B</strong> — replace with the guidance shown when the user reaches this leaf.</p>
  </div>
  <div id="ff-result-c" class="hidden result">
    <p><strong>Result C</strong> — replace with the guidance shown when the user reaches this leaf.</p>
  </div>
</div>`,
  },
];

export function groupByCategory(): Record<ComponentCategory, PaletteComponent[]> {
  const grouped: Record<ComponentCategory, PaletteComponent[]> = {
    Callouts: [],
    Navigation: [],
    Content: [],
    Forms: [],
  };
  for (const c of COMPONENTS) {
    grouped[c.category].push(c);
  }
  return grouped;
}
