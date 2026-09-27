# PaddleOCR models (ONNX)

Text detection and recognition models used for the "second look" pass.

| File | Model | Size | SHA-256 |
| --- | --- | --- | --- |
| `en_PP-OCRv3_det_infer.onnx` | PP-OCRv3 English text detection (DB) | 2.4 MB | `f139598bc2af4e4b6fe98dec11574e30edfdd91fc94ac1425c18ace3bd5a866b` |
| `en_PP-OCRv4_rec.onnx` | PP-OCRv4 English text recognition (SVTR, CTC) | 7.7 MB | `870d81b658bb0ba59ae4a2aecf21f879e4921002be29d208cdcdb977af6e0959` |
| `en_dict.txt` | Character list for the recognition model | 190 B | `5662df9d2d03f0e8ca0d3b0649d6acbab904b6a14b3d3521463c71c37c668ce3` |

- Origin: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), converted to ONNX by the
  [RapidOCR](https://github.com/RapidAI/RapidOCR) project; taken unmodified from the npm package
  `paddle-ocr-onnx-models@0.2.0`. The dictionary is the `character` metadata of the
  `en_PP-OCRv3_rec_infer.onnx` model from the same package.
- License: Apache-2.0 (PaddleOCR).

They are committed to the repository (10 MB) so the app is self-contained: it never downloads
models from a third-party host at run time.
