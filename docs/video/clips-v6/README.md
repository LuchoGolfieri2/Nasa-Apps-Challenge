# Clips del video v6 (30 s)

Un clip por escena, todos a 1920×1080, 30 fps, H.264 y sin audio. Se unen sin volver a codificar:

```
ls c*.mp4 | sed "s/^/file '/;s/$/'/" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4
```

Después se suman los subtítulos (`../field-rewind-demo-30s-en-v6.srt`), la marca "Made with AI assistance" y la música.

| Clip | Escena | Duración |
|---|---|---|
| `c01_landing_map.mp4` | Portada con Map y My Farm; clic en Map | 1,3 s |
| `c02_split.mp4` | Celular con el globo y el agricultor; "Not sure what to plant next season?" | 3,6 s |
| `c03_globe.mp4` | Globo (11 estados y 5 provincias) hasta Story County, Iowa | 3,6 s |
| `c04_history.mp4` | Historia de Story, 2015 a 2025 | 3,6 s |
| `c05_how.mp4` | How it works | 2,5 s |
| `c06_next_twins.mp4` | Próxima campaña de Story con los condados gemelos | 7,4 s |
| `c07_farm.mp4` | My Farm | 3,5 s |
| `c08_world.mp4` | "Next: the world · The same question, on any farm" | 3,0 s |
| `c09_logo.mp4` | Logo | 1,5 s |

El globo usa la imagen Blue Marble de la NASA (la misma que la app). Las pantallas son capturas del sitio corriendo en local.
