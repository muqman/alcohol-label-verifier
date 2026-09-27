// Fetch a binary asset (model weights) with an error message a person can act on.
export async function fetchBinary(url: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`Could not download ${url.split('/').pop()} (network error)`);
  }
  if (!res.ok) {
    throw new Error(`Could not download ${url.split('/').pop()} (HTTP ${res.status}). If the site runs on IIS, check that the included web.config was deployed.`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
