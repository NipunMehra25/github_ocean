# Fish Mapping By GitHub Activity

This project maps each GitHub username to a fish model using a combined activity score.

## Score Formula

`score = commits + (public_repositories * 120)`

- Commits are fetched from GitHub commit search (`author:<username>`).
- Public repositories are fetched from the user profile (`public_repos`).
- Repo count acts as a boost when commit counts are similar.

## Mapping Tiers

| Tier | Score Range | Fish Asset |
|---|---:|---|
| 1 | `< 100` | `guppy_fish.glb` |
| 2 | `100 - 249` | `guppie_animated.glb` |
| 3 | `250 - 499` | `small_fish.glb` |
| 4 | `500 - 999` | `redcap_oranda_goldfish.glb` |
| 5 | `1000 - 1999` | `feather_fish.glb` |
| 6 | `2000 - 3499` | `bream_fish__dorade_royale.glb` |
| 7 | `3500 - 5499` | `emperor_angelfish_update_v2.glb` |
| 8 | `5500 - 7999` | `model_65a_-_longnose_gar.glb` |
| 9 | `8000 - 10999` | `model_66a_-_atlantic_sturgeon.glb` |
| 10 | `11000 - 14999` | `tuna_fish.glb` |
| 11 | `15000 - 19999` | `manta_ray_birostris_animated.glb` |
| 12 | `20000 - 25999` | `shark.glb` |
| 13 | `26000 - 33999` | `chelicerate.glb` |
| 14 | `34000 - 43999` | `model_99a_-_whale_shark.glb` |
| 15 | `44000 - 55999` | `whale.glb` |
| 16 | `>= 56000` | `mega_whale.glb` |

## Runtime Behavior

- User enters a GitHub username and clicks `Dive`.
- App fetches profile + commits.
- App computes score and selects fish from the table above.
- The assigned fish is auto-loaded and displayed.
- The selected fish name and score explanation are shown in the video overlay panel.
