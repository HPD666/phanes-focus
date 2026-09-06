import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Hit shape surfaced to the Focus HUD by the real object identification flow.
 */
export type Hit = {
  label: string;
  confidence: number;
  source: "exact" | "generic";
  description: string | null;
  price: string | null;
  url: string | null;
  imageUrl: string | null;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
};

/**
 * PHANES REAL OBJECT IDENTIFICATION
 * ----------------------------------
 * This Convex action is the server-side enrichment layer. The browser's
 * TensorFlow.js COCO-SSD detects the object in the live frame and returns a
 * real class label (e.g. "chair", "bottle", "laptop"). This action then:
 *
 *   1. Searches DuckDuckGo's free Instant Answer API for the detected label
 *   2. Extracts a real description, source URL, and price when available
 *   3. Returns the enriched hit to the Focus HUD
 *
 * Everything is free forever — DuckDuckGo's API requires no API key.
 * No paid provider, no subscription, no cloud bill.
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
    const enrichment = await webEnrichment(args.detectedLabel);

    return {
      label: enrichment.label ?? args.detectedLabel,
      confidence: Math.min(
        0.99,
        Math.max(args.confidence, enrichment.confidence),
      ),
      source: enrichment.confidence >= 0.7 ? ("exact" as const) : ("generic" as const),
      description: enrichment.description,
      price: enrichment.price,
      url: enrichment.url,
      imageUrl: enrichment.imageUrl,
      box: args.box ?? null,
    };
  },
});

/**
 * DuckDuckGo Instant Answer API lookup — free, no key required.
 */
async function webEnrichment(
  query: string,
): Promise<{
  label: string | null;
  description: string | null;
  price: string | null;
  url: string | null;
  imageUrl: string | null;
  confidence: number;
}> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
    );
    if (!res.ok) {
      return fallbackEnrichment(query);
    }
    const data = await res.json();

    const abstract = String(data.AbstractText ?? "");
    const abstractUrl = typeof data.AbstractURL === "string" ? data.AbstractURL : null;
    const heading = String(data.Heading ?? query);
    const image = typeof data.Image === "string" ? data.Image : null;

    // Check for price in results
    let price: string | null = null;
    const results: unknown[] = Array.isArray(data.Results) ? data.Results : [];
    for (const r of results) {
      if (typeof r === "object" && r !== null) {
        const result = r as Record<string, unknown>;
        const text = String(result.Text ?? "");
        const priceMatch = text.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          price = priceMatch[0];
          break;
        }
      }
    }

    // Find best description from RelatedTopics
    const related: unknown[] = Array.isArray(data.RelatedTopics)
      ? data.RelatedTopics
      : [];
    let bestDescription = abstract;
    let bestUrl = abstractUrl;
    for (const topic of related.slice(0, 5)) {
      if (typeof topic === "object" && topic !== null) {
        const t = topic as Record<string, unknown>;
        const text = String(t.Text ?? "");
        if (!bestDescription && text.length > 20) {
          bestDescription = text;
        }
        if (!bestUrl && typeof t.FirstURL === "string") {
          bestUrl = t.FirstURL;
        }
      }
    }

    if (!bestDescription && results.length > 0) {
      const first = results[0] as Record<string, unknown>;
      bestDescription = String(first.Text ?? "");
      if (!bestUrl && typeof first.FirstURL === "string") {
        bestUrl = first.FirstURL;
      }
    }

    const hasData = Boolean(bestDescription || bestUrl || price);

    return {
      label: heading || query,
      description: bestDescription || null,
      price,
      url: bestUrl,
      imageUrl: image,
      confidence: hasData ? 0.85 : 0.55,
    };
  } catch {
    return fallbackEnrichment(query);
  }
}

/**
 * Fallback when the network is unavailable — returns a real, honest
 * description from a local knowledge base of common COCO classes.
 */
function fallbackEnrichment(query: string): {
  label: string;
  description: string;
  price: string | null;
  url: string;
  imageUrl: string | null;
  confidence: number;
} {
  const lower = query.toLowerCase();
  const known = KNOWN_OBJECTS[lower];

  return {
    label: known?.name ?? query,
    description:
      known?.description ??
      `Detected by Phanes COCO-SSD neural network. Category: "${query}".`,
    price: null,
    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    imageUrl: null,
    confidence: known ? 0.72 : 0.5,
  };
}

/**
 * Local enrichment for the 80 COCO classes — used only when the network is
 * unavailable. Descriptions are factual and sourced from public knowledge.
 */
const KNOWN_OBJECTS: Record<string, { name: string; description: string }> = {
  chair: {
    name: "Chair",
    description:
      "A separate seat for one person, typically with a back and four legs. Common materials include wood, metal, plastic, and upholstery.",
  },
  bottle: {
    name: "Bottle",
    description:
      "A rigid or semi-rigid container typically made of glass or plastic, used for storing liquids.",
  },
  cup: {
    name: "Cup",
    description:
      "A small open container used for drinking, typically circular and made of ceramic, glass, or plastic.",
  },
  laptop: {
    name: "Laptop Computer",
    description:
      "A portable personal computer with a clamshell form factor, integrating screen, keyboard, and trackpad.",
  },
  keyboard: {
    name: "Keyboard",
    description:
      "An input device with a set of keys for operating a typewriter or computer.",
  },
  mouse: {
    name: "Computer Mouse",
    description:
      "A handheld pointing device that detects two-dimensional motion relative to a surface, used to control a cursor.",
  },
  "cell phone": {
    name: "Cell Phone",
    description:
      "A portable telephone that can make and receive calls over a radio link while moving over a wide area.",
  },
  tv: {
    name: "Television",
    description:
      "A telecommunication medium for transmitting moving images and sound, used for entertainment and information.",
  },
  "potted plant": {
    name: "Potted Plant",
    description:
      "A plant grown in a container, used for indoor decoration and air purification.",
  },
  bed: {
    name: "Bed",
    description:
      "A piece of furniture for sleep or rest, typically a framework with a mattress and coverings.",
  },
  couch: {
    name: "Couch / Sofa",
    description:
      "A long upholstered piece of furniture for several people to sit on.",
  },
  "dining table": {
    name: "Dining Table",
    description:
      "A table designed for eating meals, typically seating four or more people.",
  },
  book: {
    name: "Book",
    description:
      "A written or printed work consisting of pages, bound together and protected by a cover.",
  },
  clock: {
    name: "Clock",
    description:
      "An instrument used to measure and show time, typically with a face and hands or a digital display.",
  },
  vase: {
    name: "Vase",
    description:
      "An open container, typically made of glass or ceramic, used for holding cut flowers or for decoration.",
  },
  scissors: {
    name: "Scissors",
    description:
      "A cutting instrument consisting of two blades pivoted so that the sharpened edges slide against each other.",
  },
  handbag: {
    name: "Handbag",
    description:
      "A woman's bag used to carry personal items such as keys, phone, wallet, and cosmetics.",
  },
  backpack: {
    name: "Backpack",
    description:
      "A bag with shoulder straps that allow it to be carried on one's back, used for carrying personal items.",
  },
  umbrella: {
    name: "Umbrella",
    description:
      "A device consisting of a circular canopy of cloth on a folding metal frame, used as protection against rain.",
  },
  tie: {
    name: "Necktie",
    description:
      "A long piece of cloth worn for decorative purposes around the neck, resting under the shirt collar.",
  },
  suitcase: {
    name: "Suitcase",
    description:
      "A case with a handle and hinged lid, used for carrying clothes and other personal possessions.",
  },
  "wine glass": {
    name: "Wine Glass",
    description:
      "A type of glass stemware used to drink and taste wine, with a bowl, stem, and foot.",
  },
  bowl: {
    name: "Bowl",
    description:
      "A round, deep dish or basin used for food or liquid.",
  },
  fork: {
    name: "Fork",
    description:
      "An eating utensil with two or more prongs, used for lifting food to the mouth or holding it when cutting.",
  },
  knife: {
    name: "Knife",
    description:
      "A tool or weapon with a cutting edge or blade, typically used for cutting food.",
  },
  spoon: {
    name: "Spoon",
    description:
      "An eating utensil with a small shallow bowl on a handle, used for stirring, serving, or eating food.",
  },
  pizza: {
    name: "Pizza",
    description:
      "A dish of Italian origin consisting of a flat, round base of dough baked with a topping of tomato sauce and cheese.",
  },
  banana: {
    name: "Banana",
    description:
      "A long curved fruit which grows in clusters and has soft pulpy flesh and a smooth skin, turning yellow when ripe.",
  },
  apple: {
    name: "Apple",
    description:
      "A round fruit of a tree of the rose family, which has red or green edible flesh and a thin skin.",
  },
  orange: {
    name: "Orange (Fruit)",
    description:
      "A large round citrus fruit with a tough bright orange rind, containing segments of juicy flesh.",
  },
  sandwich: {
    name: "Sandwich",
    description:
      "A food item consisting of vegetables, sliced meat, or cheese placed on or between slices of bread.",
  },
  broccoli: {
    name: "Broccoli",
    description:
      "A plant of the cabbage family whose dark green flower head is eaten as a vegetable.",
  },
  carrot: {
    name: "Carrot",
    description:
      "A tapering orange root eaten as a vegetable, rich in beta-carotene.",
  },
  "hot dog": {
    name: "Hot Dog",
    description:
      "A sausage served in the slit of a partially sliced bun, often topped with mustard, ketchup, or onions.",
  },
  cake: {
    name: "Cake",
    description:
      "A sweet baked food made from a mixture of flour, sugar, eggs, and other ingredients.",
  },
  donut: {
    name: "Donut / Doughnut",
    description:
      "A small fried dough confection, typically ring-shaped and topped with sugar, icing, or chocolate.",
  },
  "teddy bear": {
    name: "Teddy Bear",
    description:
      "A soft toy in the form of a bear, typically stuffed with soft material and covered with plush fabric.",
  },
  toothbrush: {
    name: "Toothbrush",
    description:
      "A small brush used for cleaning the teeth, typically having a long handle and nylon bristles.",
  },
  "hair drier": {
    name: "Hair Dryer",
    description:
      "An electrical device used to dry and style hair by blowing heated air over wet hair.",
  },
  refrigerator: {
    name: "Refrigerator",
    description:
      "A large electrical appliance used to keep food and drinks cool and fresh at low temperatures.",
  },
  microwave: {
    name: "Microwave Oven",
    description:
      "A kitchen appliance that heats food quickly using electromagnetic radiation in the microwave frequency range.",
  },
  toaster: {
    name: "Toaster",
    description:
      "A small electrical appliance used to brown slices of bread by exposing them to radiant heat.",
  },
  oven: {
    name: "Oven",
    description:
      "A thermally insulated chamber used for heating, baking, or drying of a substance.",
  },
  sink: {
    name: "Sink",
    description:
      "A fixed basin with a faucet and drain, used for washing dishes, hands, and food.",
  },
  person: {
    name: "Person",
    description:
      "A human being detected in the frame by the COCO-SSD neural network.",
  },
  car: {
    name: "Car / Automobile",
    description:
      "A road vehicle, typically with four wheels, powered by an internal combustion engine and able to carry a small number of people.",
  },
  bicycle: {
    name: "Bicycle",
    description:
      "A vehicle composed of two wheels held in a frame one behind the other, propelled by pedals.",
  },
  motorcycle: {
    name: "Motorcycle",
    description:
      "A two-wheeled motor vehicle, powered by an engine or electric motor.",
  },
  bus: {
    name: "Bus",
    description:
      "A large motor vehicle carrying passengers by road, typically one serving a fixed route and schedule.",
  },
  truck: {
    name: "Truck",
    description:
      "A large, heavy motor vehicle used for transporting goods, materials, or troops.",
  },
  airplane: {
    name: "Airplane",
    description:
      "A powered flying vehicle with fixed wings and a weight greater than that of the air it displaces.",
  },
  train: {
    name: "Train",
    description:
      "A series of connected railway vehicles that travel along a track, used for transporting passengers or freight.",
  },
  boat: {
    name: "Boat",
    description:
      "A small vessel for traveling over water, propelled by oars, sails, or an engine.",
  },
  "traffic light": {
    name: "Traffic Light",
    description:
      "A set of automatically operated colored lights for controlling traffic at road junctions and crosswalks.",
  },
  "stop sign": {
    name: "Stop Sign",
    description:
      "A traffic sign designed to notify drivers that they must come to a complete halt and make sure the intersection is clear.",
  },
  "fire hydrant": {
    name: "Fire Hydrant",
    description:
      "A connection point by which firefighters can tap into a water supply to extinguish fires.",
  },
  "parking meter": {
    name: "Parking Meter",
    description:
      "A device used to collect money in exchange for the right to park a vehicle in a particular place for a limited time.",
  },
  bench: {
    name: "Bench",
    description:
      "A long seat for several people, typically made of wood or stone.",
  },
  dog: {
    name: "Dog",
    description:
      "A domesticated carnivorous mammal, typically kept as a pet or for working purposes.",
  },
  cat: {
    name: "Cat",
    description:
      "A small domesticated carnivorous mammal with soft fur, a short snout, and retractable claws.",
  },
  bird: {
    name: "Bird",
    description:
      "A warm-blooded egg-laying vertebrate characterized by feathers, wings, and a beak.",
  },
  horse: {
    name: "Horse",
    description:
      "A large four-legged animal used for riding, racing, and carrying loads.",
  },
  sheep: {
    name: "Sheep",
    description:
      "A woolly four-legged ruminant animal, often kept in flocks for its wool or meat.",
  },
  cow: {
    name: "Cow",
    description:
      "A large farm animal that produces milk and beef.",
  },
  elephant: {
    name: "Elephant",
    description:
      "A very large herbivorous mammal with a trunk, long tusks, and large ear flaps.",
  },
  bear: {
    name: "Bear",
    description:
      "A large, heavy omnivorous mammal with thick fur and a short tail.",
  },
  zebra: {
    name: "Zebra",
    description:
      "An African wild horse with black-and-white stripes and an erect mane.",
  },
  giraffe: {
    name: "Giraffe",
    description:
      "A large African mammal with a very long neck and forelegs, having a spotted coat pattern.",
  },
  "sports ball": {
    name: "Sports Ball",
    description:
      "A spherical object used in various sports and games.",
  },
  kite: {
    name: "Kite",
    description:
      "A framework covered with paper, cloth, or plastic, and designed to be flown in the air at the end of a long string.",
  },
  skateboard: {
    name: "Skateboard",
    description:
      "A short narrow board with two small wheels fixed to the bottom of either end, used for sport.",
  },
  surfboard: {
    name: "Surfboard",
    description:
      "A long narrow board used in surfing, designed to be ridden on the forward face of a moving wave.",
  },
  frisbee: {
    name: "Frisbee",
    description:
      "A light, disc-shaped object thrown and caught in recreational games.",
  },
  "tennis racket": {
    name: "Tennis Racket",
    description:
      "A stringed sporting implement used to hit a ball in the game of tennis.",
  },
  "baseball bat": {
    name: "Baseball Bat",
    description:
      "A smooth wooden or metal club used in the sport of baseball to hit the ball.",
  },
  "baseball glove": {
    name: "Baseball Glove",
    description:
      "A large leather glove worn by baseball players to catch the ball.",
  },
  snowboard: {
    name: "Snowboard",
    description:
      "A board with bindings, used to descend snow-covered slopes while standing.",
  },
  skis: {
    name: "Skis",
    description:
      "A long, narrow strip of hard, flexible material worn underfoot for gliding over snow.",
  },
};
