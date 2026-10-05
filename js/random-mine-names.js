/* TerraMine: "Random Mine Names" generator for Bulk Rename (mines, activity, visitors, full-map).
 * Mad Libs style: "<Adjective> <Noun> Mine", e.g. "Rusty Pickaxe Mine" (no leading "The").
 * Theme: mining, old boom towns, Wild West prospecting, and playful mishaps
 * (broken gear, cave-ins, lost canaries, dynamite goofs). Family-friendly words only.
 * Exposes window.TerraMineRandomNames = { ADJECTIVES, NOUNS, format, one, batch }.
 */
(function (root) {
  'use strict';
  var ADJECTIVES = [
    // Rough-and-tumble mining gear
    'Rusty', 'Dusty', 'Creaky', 'Squeaky', 'Rickety', 'Wobbly', 'Dented', 'Busted',
    'Broken', 'Wonky', 'Leaky', 'Lopsided', 'Crooked', 'Tarnished', 'Patched', 'Duct-Taped',
    // Cave-ins, collapses and dynamite mishaps
    'Caved-In', 'Collapsed', 'Crumbly', 'Rumbling', 'Tumbling', 'Shaky', 'Flooded', 'Smoky',
    'Sooty', 'Singed', 'Scorched', 'Fizzling', 'Sputtering', 'Smoldering', 'Crackling', 'Kaboom',
    'Runaway', 'Derailed', 'Backfiring', 'Overloaded', 'Upside-Down', 'Topsy-Turvy',
    // Precious (and not so precious) metals
    'Golden', 'Silver', 'Copper', 'Brass', 'Iron', 'Tin', 'Nickel', 'Quartz',
    'Glittering', 'Sparkly', 'Shiny', 'Gritty', 'Gravelly', 'Muddy', 'Rocky', 'Sandy',
    // Boom towns, ghost towns and tall tales
    'Lonesome', 'Forgotten', 'Abandoned', 'Lost', 'Hidden', 'Secret', 'Buried', 'Bottomless',
    'Echoing', 'Drafty', 'Haunted', 'Legendary', 'Mysterious', 'Peculiar', 'Ancient', 'Frontier',
    'Boomtown', 'Sagebrush', 'Midnight', 'Dusky', 'Windy', 'Wild',
    // Colorful critter moods
    'Purple', 'Sticky', 'Grumpy', 'Cranky', 'Ornery', 'Stubborn', 'Rowdy', 'Lucky',
    'Unlucky', 'Bashful', 'Sleepy', 'Soggy', 'Dizzy', 'Clumsy', 'Jolly', 'Plucky',
    'Scrappy', 'Thrifty', 'Hapless', 'Frazzled', 'Befuddled', 'Jumpy', 'Whistling', 'Yodeling',
    'Snoring', 'Hiccuping', 'Sneezing', 'Giggling', 'Wacky', 'Goofy', 'Mighty', 'Bearded'
  ];
  var NOUNS = [
    // Tools and equipment
    'Pickaxe', 'Shovel', 'Lantern', 'Gold Pan', 'Sluice', 'Ore Cart', 'Wheelbarrow', 'Bucket',
    'Ladder', 'Pulley', 'Winch', 'Hard Hat', 'Headlamp', 'Candle', 'Compass', 'Treasure Map',
    'Anvil', 'Hammer', 'Chisel', 'Drill', 'Crowbar', 'Wrench', 'Sprocket', 'Boiler',
    // Mishaps and mayhem
    'Dynamite', 'Fuse', 'Cave-In', 'Rockslide', 'Mishap', 'Blunder', 'Stampede', 'Hiccup',
    'Canary', 'Kerfuffle', 'Hullabaloo', 'Ruckus',
    // Rocks, riches and the lay of the land
    'Nugget', 'Boulder', 'Pebble', 'Geode', 'Stalactite', 'Stalagmite', 'Tunnel', 'Cavern',
    'Canyon', 'Gulch', 'Ridge', 'Mesa', 'Butte', 'Creek', 'Claim', 'Mother Lode',
    'Jackpot', 'Vein', 'Gold Rush', 'Ghost Town',
    // Wild West folks and things
    'Prospector', 'Hermit', 'Sheriff', 'Deputy', 'Bandit', 'Cowpoke', 'Wrangler', 'Stagecoach',
    'Wagon', 'Horseshoe', 'Spur', 'Saddle', 'Lasso', 'Bandana', 'Banjo', 'Harmonica',
    'Fiddle', 'Skillet', 'Coffee Pot', 'Biscuit', 'Flapjack', 'Bean Pot', 'Handcar', 'Caboose',
    'Water Tower', 'Windmill', 'Outhouse', 'Gold Tooth', 'Mustache', 'Suspenders', 'Long Johns',
    // Critters (plus a few fanciful ones)
    'Mule', 'Burro', 'Coyote', 'Rattlesnake', 'Jackrabbit', 'Armadillo', 'Buzzard', 'Badger',
    'Gopher', 'Bat', 'Wombat', 'Porcupine', 'Raccoon', 'Tumbleweed', 'Cactus', 'Goblin',
    'Gnome', 'Troll'
  ];

  function format(adj, noun) {
    return adj + ' ' + noun + ' Mine';
  }
  function pick(list, rnd) {
    return list[Math.floor(rnd() * list.length) % list.length];
  }
  function shuffled(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)) % (i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // One random name. opts.avoid: Set/array of names to skip when possible.
  function one(opts) {
    return batch(1, opts)[0];
  }
  // count names, unique within the batch whenever count <= adjectives x nouns.
  // Adjectives and nouns are dealt from shuffled decks so a batch repeats a word only
  // after the whole deck has been used. opts.avoid: names to skip (e.g. the previous roll,
  // so Reroll always changes every name). opts.random: RNG returning [0, 1) (tests).
  function batch(count, opts) {
    opts = opts || {};
    var rnd = typeof opts.random === 'function' ? opts.random : Math.random;
    var n = Math.max(0, Math.floor(Number(count) || 0));
    var avoid = new Set();
    if (opts.avoid) {
      (opts.avoid instanceof Set ? Array.from(opts.avoid) : [].concat(opts.avoid)).forEach(function (x) {
        if (x) avoid.add(String(x));
      });
    }
    var combos = ADJECTIVES.length * NOUNS.length;
    var used = new Set();
    var out = [];
    var adjDeck = [], nounDeck = [];
    for (var k = 0; k < n; k++) {
      var name = '';
      for (var tries = 0; tries < 60; tries++) {
        if (!adjDeck.length) adjDeck = shuffled(ADJECTIVES, rnd);
        if (!nounDeck.length) nounDeck = shuffled(NOUNS, rnd);
        // Late tries fall back to fully random picks so we do not burn through the decks.
        var adj = tries < 20 ? adjDeck.pop() : pick(ADJECTIVES, rnd);
        var noun = tries < 20 ? nounDeck.pop() : pick(NOUNS, rnd);
        name = format(adj, noun);
        if (!used.has(name) && !avoid.has(name)) break;
        if (used.size + avoid.size >= combos && !used.has(name)) break; // nothing new left
      }
      if (used.has(name) && used.size < combos) {
        // Rare: scan for any unused combination rather than repeat a name.
        var offA = Math.floor(rnd() * ADJECTIVES.length), offN = Math.floor(rnd() * NOUNS.length);
        scan:
        for (var a = 0; a < ADJECTIVES.length; a++) {
          for (var b = 0; b < NOUNS.length; b++) {
            var cand = format(ADJECTIVES[(a + offA) % ADJECTIVES.length], NOUNS[(b + offN) % NOUNS.length]);
            if (!used.has(cand) && !avoid.has(cand)) { name = cand; break scan; }
            if (!used.has(cand) && used.has(name)) name = cand;
          }
        }
      }
      used.add(name);
      out.push(name);
    }
    return out;
  }
  root.TerraMineRandomNames = {
    ADJECTIVES: ADJECTIVES.slice(),
    NOUNS: NOUNS.slice(),
    format: format,
    one: one,
    batch: batch
  };
})(typeof window !== 'undefined' ? window : this);
