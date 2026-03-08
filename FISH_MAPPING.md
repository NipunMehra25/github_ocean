# Fish Mapping By GitHub Activity

This project maps each GitHub username to an ocean creature using a 2D tier system:

- Commit tier = coding activity depth
- Repo tier = breadth across projects

Users with similar commits but different repo counts land on different creatures.

## Bucket Logic

- Commit bucket limits: `[120, 320, 700, 1500, 3200, 7000, 14000]` (8 commit buckets)
- Repo bucket limits: `[4, 10, 21]` (4 repo buckets)

Index formula:

`tier_index = (commit_tier * 4) + repo_tier`

- `commit_tier` in `0..7`
- `repo_tier` in `0..3`
- total tiers = `8 * 4 = 32`

## Band Labels

- Commit band labels:
`< 120`, `120-319`, `320-699`, `700-1499`, `1500-3199`, `3200-6999`, `7000-13999`, `>= 14000`
- Repo band labels:
`< 4`, `4-9`, `10-20`, `>= 21`

## Tier Progression (1-32)

1. `guppy_fish.glb`
2. `guppie_animated.glb`
3. `small_fish.glb`
4. `redcap_oranda_goldfish.glb`
5. `feather_fish.glb`
6. `bream_fish__dorade_royale.glb`
7. `emperor_angelfish_update_v2.glb`
8. `model_47a_-_loggerhead_sea_turtle.glb`
9. `model_65a_-_longnose_gar.glb`
10. `model_66a_-_atlantic_sturgeon.glb`
11. `tuna_fish.glb`
12. `manta_ray_birostris_animated.glb`
13. `liriope_jellyfish_trachymedusae.glb`
14. `shark.glb`
15. `nile_crocodile_swimming.glb`
16. `cryptosuchus.glb`
17. `pistosaur_animated.glb`
18. `f161272aebe34682bb0ff09ce7b76cc9.glb`
19. `chelicerate.glb`
20. `model_99a_-_whale_shark.glb`
21. `whale.glb` (display name: Orca)
22. `glow_whale.glb`
23. `shadow_leviathan.glb`
24. `mega_whale.glb`
25. `tinkle_the_blue_ring_octopus.glb`
26. `reefback.glb`
27. `tulkun_swimming_loop.glb`
28. `sea_monster_animated.glb`
29. `ghost_leviathan.glb`
30. `kraken_v2.glb`
31. `moon_harvest_-_leviathan.glb`
32. `the_leviathan.glb`

## Runtime Behavior

- User enters a GitHub username and clicks `Dive`.
- App fetches profile + commit counts.
- App computes commit bucket + repo bucket.
- App maps bucket pair to `tier_index`.
- Assigned fish, band labels, and fish lore are shown in the overlay panel.
