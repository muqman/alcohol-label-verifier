// Fetch a model file with an error message a person can act on.
export async function fetchBinary(url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetchOk(url)).arrayBuffer());
}

export async function fetchText(url: string): Promise<string> {
  return (await fetchOk(url)).text();
}

async function fetchOk(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`Could not download ${url.split('/').pop()} (network error)`);
  }
  if (!res.ok) {
    throw new Error(`Could not download ${url.split('/').pop()} (HTTP ${res.status}). If the site runs on IIS, check that the included web.config was deployed.`);
  }
  return res;
}
