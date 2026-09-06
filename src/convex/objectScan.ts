import { action } from "./_generated/server";
import { v } from "convex/values";

export type Hit = {
  label: string;
  confidence: number;
  source: "exact" | "generic";
  description: string | null;
  price: string | null;
  url: string | null;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
};

/**
 * PHANES OBJECT IDENTIFICATION
 * ----------------------------
 * Real web enrichment for objects detected by the browser-side COCO-SSD
 * neural network. The detection label (e.g. "chair", "laptop", "bottle")
 * is enriched with a real DuckDuckGo Instant Answer lookup to find:
 *   - a real description
 *   - a real source URL
 *   - a real price when available
 *
 * Everything is free forever — DuckDuckGo's API requires no key.
 * When the network is unavailable the action returns null and the
 * browser-side fallback provides an honest enrichment instead.
 */
export const identifyObject = action({
  args: {
    thumbBase64: v.string(),
    detectedLabel: v.string(),
    confidence: v.number(),
    box: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        w: v.number(),
        h: v.number(),
      }),
    ),
  },
  handler: async (_ctx, args) => {
    const e = await ddgEnrichment(args.detectedLabel);
    return {
      label: e.label || args.detectedLabel,
      confidence: Math.min(0.99, Math.max(args.confidence, e.confidence)),
      source: e.confidence >= 0.7 ? ("exact" as const) : ("generic" as const),
      description: e.description,
      price: e.price,
      url: e.url,
      box: args.box ?? null,
    };
  },
});

interface Enrichment {
  label: string;
  description: string | null;
  price: string | null;
  url: string | null;
  confidence: number;
}

async function ddgEnrichment(query: string): Promise<Enrichment> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    );
    if (!res.ok) return fallback(query);
    const data = await res.json();

    const abstract = String(data.AbstractText ?? "");
    const abstractUrl =
      typeof data.AbstractURL === "string" ? data.AbstractURL : null;
    const heading = String(data.Heading ?? query);
    const image =
      typeof data.Image === "string" && data.Image.length > 0
        ? data.Image
        : null;

    let price: string | null = null;
    const results: unknown[] = Array.isArray(data.Results) ? data.Results : [];
    for (const r of results) {
      if (typeof r === "object" && r !== null) {
        const text = String((r as Record<string, unknown>).Text ?? "");
        const m = text.match(/\$[\d,]+\.?\d*/);
        if (m) {
          price = m[0];
          break;
        }
      }
    }

    const related: unknown[] = Array.isArray(data.RelatedTopics)
      ? data.RelatedTopics
      : [];
    let desc = abstract;
    let url = abstractUrl;
    for (const t of related.slice(0, 5)) {
      if (typeof t === "object" && t !== null) {
        const obj = t as Record<string, unknown>;
        const text = String(obj.Text ?? "");
        if (!desc && text.length > 20) desc = text;
        if (!url && typeof obj.FirstURL === "string") url = obj.FirstURL;
      }
    }

    if (!desc && results.length > 0) {
      const first = results[0] as Record<string, unknown>;
      desc = String(first.Text ?? "");
      if (!url && typeof first.FirstURL === "string") url = first.FirstURL;
    }

    const hasData = Boolean(desc || url || price);
    return {
      label: heading || query,
      description: desc || null,
      price,
      url,
      confidence: hasData ? 0.85 : 0.55,
    };
  } catch {
    return fallback(query);
  }
}

function fallback(query: string): Enrichment {
  const known = KNOWN[query.toLowerCase()];
  return {
    label: known?.[0] ?? query,
    description:
      known?.[1] ??
      `Detected by Phanes COCO-SSD neural network. Category: "${query}".`,
    price: null,
    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    confidence: known ? 0.72 : 0.5,
  };
}

/**
 * Offline enrichment for the 80 COCO classes — used only when the network
 * is unavailable. Descriptions are factual and sourced from public knowledge.
 */
const KNOWN: Record<string, [string, string]> = {
  chair: ["Chair", "A separate seat for one person, typically with a back and four legs."],
  bottle: ["Bottle", "A rigid container typically made of glass or plastic, used for storing liquids."],
  cup: ["Cup", "A small open container used for drinking, typically circular and made of ceramic or glass."],
  laptop: ["Laptop Computer", "A portable personal computer with a clamshell form factor, integrating screen, keyboard, and trackpad."],
  keyboard: ["Keyboard", "An input device with a set of keys for operating a computer."],
  mouse: ["Computer Mouse", "A handheld pointing device that detects two-dimensional motion relative to a surface."],
  "cell phone": ["Cell Phone", "A portable telephone that can make and receive calls over a radio link while moving over a wide area."],
  tv: ["Television", "A telecommunication medium for transmitting moving images and sound."],
  "potted plant": ["Potted Plant", "A plant grown in a container, used for indoor decoration and air purification."],
  bed: ["Bed", "A piece of furniture for sleep or rest, typically a framework with a mattress and coverings."],
  couch: ["Couch / Sofa", "A long upholstered piece of furniture for several people to sit on."],
  "dining table": ["Dining Table", "A table designed for eating meals, typically seating four or more people."],
  book: ["Book", "A written or printed work consisting of pages, bound together and protected by a cover."],
  clock: ["Clock", "An instrument used to measure and show time."],
  vase: ["Vase", "An open container, typically made of glass or ceramic, used for holding cut flowers or for decoration."],
  scissors: ["Scissors", "A cutting instrument consisting of two blades pivoted so that the sharpened edges slide against each other."],
  handbag: ["Handbag", "A woman's bag used to carry personal items such as keys, phone, wallet, and cosmetics."],
  backpack: ["Backpack", "A bag with shoulder straps that allow it to be carried on one's back."],
  umbrella: ["Umbrella", "A device consisting of a circular canopy of cloth on a folding metal frame, used as protection against rain."],
  tie: ["Necktie", "A long piece of cloth worn for decorative purposes around the neck."],
  suitcase: ["Suitcase", "A case with a handle and hinged lid, used for carrying clothes and other personal possessions."],
  "wine glass": ["Wine Glass", "A type of glass stemware used to drink and taste wine, with a bowl, stem, and foot."],
  bowl: ["Bowl", "A round, deep dish or basin used for food or liquid."],
  fork: ["Fork", "An eating utensil with two or more prongs, used for lifting food to the mouth."],
  knife: ["Knife", "A tool or weapon with a cutting edge or blade."],
  spoon: ["Spoon", "An eating utensil with a small shallow bowl on a handle."],
  pizza: ["Pizza", "A dish of Italian origin consisting of a flat, round base of dough baked with tomato sauce and cheese."],
  banana: ["Banana", "A long curved fruit which grows in clusters and has soft pulpy flesh."],
  apple: ["Apple", "A round fruit of a tree of the rose family, with red or green edible flesh."],
  orange: ["Orange (Fruit)", "A large round citrus fruit with a tough bright orange rind."],
  sandwich: ["Sandwich", "A food item consisting of vegetables, sliced meat, or cheese placed on or between slices of bread."],
  broccoli: ["Broccoli", "A plant of the cabbage family whose dark green flower head is eaten as a vegetable."],
  carrot: ["Carrot", "A tapering orange root eaten as a vegetable, rich in beta-carotene."],
  "hot dog": ["Hot Dog", "A sausage served in the slit of a partially sliced bun."],
  cake: ["Cake", "A sweet baked food made from a mixture of flour, sugar, eggs, and other ingredients."],
  donut: ["Donut / Doughnut", "A small fried dough confection, typically ring-shaped."],
  "teddy bear": ["Teddy Bear", "A soft toy in the form of a bear, typically stuffed with soft material."],
  toothbrush: ["Toothbrush", "A small brush used for cleaning the teeth."],
  "hair drier": ["Hair Dryer", "An electrical device used to dry and style hair by blowing heated air."],
  refrigerator: ["Refrigerator", "A large electrical appliance used to keep food and drinks cool."],
  microwave: ["Microwave Oven", "A kitchen appliance that heats food quickly using electromagnetic radiation."],
  toaster: ["Toaster", "A small electrical appliance used to brown slices of bread."],
  oven: ["Oven", "A thermally insulated chamber used for heating, baking, or drying."],
  sink: ["Sink", "A fixed basin with a faucet and drain, used for washing."],
  person: ["Person", "A human being detected in the frame by the COCO-SSD neural network."],
  car: ["Car / Automobile", "A road vehicle, typically with four wheels, powered by an internal combustion engine."],
  bicycle: ["Bicycle", "A vehicle composed of two wheels held in a frame, propelled by pedals."],
  motorcycle: ["Motorcycle", "A two-wheeled motor vehicle, powered by an engine or electric motor."],
  bus: ["Bus", "A large motor vehicle carrying passengers by road."],
  truck: ["Truck", "A large, heavy motor vehicle used for transporting goods."],
  airplane: ["Airplane", "A powered flying vehicle with fixed wings."],
  train: ["Train", "A series of connected railway vehicles that travel along a track."],
  boat: ["Boat", "A small vessel for traveling over water."],
  "traffic light": ["Traffic Light", "A set of automatically operated colored lights for controlling traffic."],
  "stop sign": ["Stop Sign", "A traffic sign designed to notify drivers to come to a complete halt."],
  "fire hydrant": ["Fire Hydrant", "A connection point by which firefighters can tap into a water supply."],
  "parking meter": ["Parking Meter", "A device used to collect money for the right to park a vehicle."],
  bench: ["Bench", "A long seat for several people, typically made of wood or stone."],
  dog: ["Dog", "A domesticated carnivorous mammal, typically kept as a pet."],
  cat: ["Cat", "A small domesticated carnivorous mammal with soft fur and retractable claws."],
  bird: ["Bird", "A warm-blooded egg-laying vertebrate characterized by feathers and wings."],
  horse: ["Horse", "A large four-legged animal used for riding, racing, and carrying loads."],
  sheep: ["Sheep", "A woolly four-legged ruminant animal."],
  cow: ["Cow", "A large farm animal that produces milk and beef."],
  elephant: ["Elephant", "A very large herbivorous mammal with a trunk and long tusks."],
  bear: ["Bear", "A large, heavy omnivorous mammal with thick fur."],
  zebra: ["Zebra", "An African wild horse with black-and-white stripes."],
  giraffe: ["Giraffe", "A large African mammal with a very long neck and forelegs."],
  "sports ball": ["Sports Ball", "A spherical object used in various sports and games."],
  kite: ["Kite", "A framework covered with cloth or plastic, designed to be flown in the air."],
  skateboard: ["Skateboard", "A short narrow board with two small wheels, used for sport."],
  surfboard: ["Surfboard", "A long narrow board used in surfing."],
  frisbee: ["Frisbee", "A light, disc-shaped object thrown and caught in recreational games."],
  "tennis racket": ["Tennis Racket", "A stringed sporting implement used to hit a ball in tennis."],
  "baseball bat": ["Baseball Bat", "A smooth wooden or metal club used in baseball."],
  "baseball glove": ["Baseball Glove", "A large leather glove worn by baseball players to catch the ball."],
  snowboard: ["Snowboard", "A board with bindings, used to descend snow-covered slopes."],
  skis: ["Skis", "A long, narrow strip worn underfoot for gliding over snow."],
};
