---
title: "An experiment: Immich on Oracle Cloud, fronted by a Cloudflare Tunnel"
date: "2026-05-04"
draft: false
summary: "A weekend project to learn how Immich, OCI, and Cloudflare Tunnels fit together — not a Google Photos replacement, just a sandbox for poking at the pieces."
---

> **Up front, because this matters:** this is a *learning experiment*, not
> a Google Photos replacement. I am running a tiny test instance on
> Oracle's [Always Free tier](https://www.oracle.com/cloud/free/) with a
> handful of sample photos to understand how the pieces — the cloud VM,
> the firewall layers, the tunnel, the identity layer — actually behave
> together. I am deliberately keeping resource usage low (about **5 GiB**
> of test data on a small block volume, not a real photo library) because
> the free tier is a generous developer offering, not an excuse to host a
> serious workload for free. If you take this writeup as a recipe, please
> size it the same way: a sandbox, with data you would be perfectly fine
> losing tomorrow. Treat anything you build on top of it as a *secondary*
> copy at best — Immich's own docs
> [say the same](https://immich.app/) since the project is still under
> heavy development.

With the disclaimer out of the way: this was a fun weekend.

The goal was not to migrate my photo library. The goal was to wire up
four unfamiliar tools — [Immich](https://immich.app), Oracle Cloud
Infrastructure (OCI),
[`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/),
and
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
— and feel out where each one's rough edges are. The thing I ended up
with is a stack that, if you ever *did* want to scale it, you could. But
that's not what this post is.

## Why this shape, conceptually?

If you self-host the traditional way — buy a domain, point an A record
at your home IP, open 80/443, run nginx with certbot — you have just
put a public TCP socket on the open internet, attached your home
address to it via DNS, and trusted your software stack to never have a
CVE. That is fine until it isn't.

The Cloudflare Tunnel approach inverts this: a daemon on your box makes
an *outbound* connection to Cloudflare's edge, and traffic flows back
through that tube
([Cloudflare's writeup of the model](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/)).
Nothing is listening on your public IP. There is nothing to portscan.

That property — "no inbound ports anywhere, on any layer" — was the
whole reason I wanted to build this. I wanted to see, end to end, what
it looks like when a service is reachable on the internet without the
host being addressable on the internet. Immich was just a convenient
guinea pig because it has a real database, a real frontend, a real
mobile app, and real upload semantics, so it would actually exercise
the tunnel.

## The OCI side, and what I did *not* touch

I picked the **VM.Standard.A1.Flex** shape — Ampere ARM, free tier
eligible
([shape details](https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm#flexible)).
I did **not** claim the full free allocation. I provisioned a small
slice, attached a modest **150GB block volume**, and only used about
**5 GiB** of it. The point was to see the system work, not to park a
personal data hoard on someone else's free hardware. If you follow
along, please do the same — claim what you need to learn, not what
the quota lets you grab. You can adjust these numbers freely; OCI's
[block volume sizing docs](https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/overview.htm)
walk through the tradeoffs, and the
[Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
are the source of truth on what's allowed.

The boot image is Ubuntu 22.04 LTS Minimal. Now, the famous OCI gotcha:
Ubuntu images on OCI ship with a default iptables ruleset that drops
basically everything inbound except SSH, *regardless* of what your VCN
security list says. Oracle has documented this for years
([blog post](https://blogs.oracle.com/developers/post/enabling-network-traffic-to-ubuntu-images-in-oracle-cloud-infrastructure)),
and most self-hosting tutorials tell you to add rules like:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
```

**I never ran those.** That is the punchline of this whole experiment.
Because `cloudflared` opens an *outbound* connection to Cloudflare's
edge, the host never needs an open inbound port — not 80, not 443, not
anything. So the OCI host firewall stayed at its default-deny posture,
the **VCN security list was never modified to allow any inbound port**,
and the network security groups stayed empty. The only thing in my
ingress rules at all was the OCI default SSH rule, which I eventually
moved behind Cloudflare Access too. After that, the box answered
absolutely nothing on the public internet. `nmap` from outside saw
zero open ports. It was, for all intents, invisible.

The interesting layer to learn here was OCI's
[VCN security list model](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm),
which splits firewalling between security lists, network security
groups, and the host firewall. Three layers is more than most clouds,
and you have to remember which one you are reasoning about at any
given moment. In this experiment, I "fought" all three by simply not
opening anything in any of them — which is a lot easier than fighting
them the usual way.

## Docker, all of it

I did not want to learn k3s for one app. Docker and `docker compose`
are fine. Install via the upstream repo, not the snap, because the
snap sandboxes paths in ways that fight you when you mount the block
volume:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Mount the block volume at `/mnt/immich`, then split it into `library/`,
`postgres/`, `model-cache/`. Immich's own
[docker-compose example](https://docs.immich.app/install/docker-compose)
is the canonical starting point; I used it almost verbatim. Edits worth
mentioning:

- I pinned image tags to a specific release rather than `release`.
  Watching Immich is fun, but I would rather upgrade on my schedule.
  The [release notes](https://github.com/immich-app/immich/releases)
  ship breaking changes more often than you'd expect for a project
  this young.
- I set `UPLOAD_LOCATION` to a path under the block volume mount and
  double-checked it with `du -sh` after the first round trip. Photos
  really do go there. `docker volume` is a trap for people who like
  knowing where their files are.
- Most importantly: I **did not publish any host ports**. No
  `ports:` block on the Immich service at all. Inside Docker's bridge
  network, containers can talk to each other freely; nothing has to
  be exposed to the host, let alone the public internet.

That last point matters because of how I ran `cloudflared`:
**also as a Docker container, in the same compose stack.** The
[official `cloudflare/cloudflared`](https://hub.docker.com/r/cloudflare/cloudflared)
image is exactly built for this. With both services on the same
Docker network, `cloudflared` reaches Immich by container name — no
host networking, no `127.0.0.1` binding, no `host.docker.internal`
nonsense. Roughly:

```yaml
services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:v1.xxx.x
    # ...volumes, env, depends_on, etc...
    # NOTE: no `ports:` block. Container is internal-only.

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARED_TUNNEL_TOKEN}
    depends_on:
      - immich-server
```

With the tunnel created in the Cloudflare dashboard
([remotely-managed tunnel guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)),
the ingress rule is configured in the Zero Trust UI instead of a
local YAML file. The "service" field for the public hostname becomes
`http://immich-server:2283` — Docker's internal DNS resolves the
container name, and the request never leaves the bridge network until
it heads back out through `cloudflared`'s outbound connection to
Cloudflare. Clean.

If you prefer the locally-managed style with a `config.yml`, the
[install guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/install-and-setup/tunnel-guide/local/)
covers it; the only differences are where the credentials live and
where the ingress rules are defined.

The first time I hit `https://photos-test.example.com` and saw the
Immich login page — TLS terminated at Cloudflare's edge with a cert
they issue and rotate, no port open anywhere on my host, no nginx, no
certbot — I sat there for a minute just looking at it.

One Immich-specific gotcha: photo and video uploads can be large, and
Cloudflare's free plan has
[upload size limits](https://developers.cloudflare.com/fundamentals/reference/upload-limits/)
that bite on big files. The Immich mobile app already chunks uploads,
so it tends to work, but if you're testing with a 4K video file via
the web UI, expect to hit it. Test with smaller files (which is what
I did).

## Auth: two locks, two keys

Cloudflare Access lets you put any HTTP application behind an
identity provider — Google, GitHub, one-time email PINs, etc.
([policy docs](https://developers.cloudflare.com/cloudflare-one/policies/access/)).
The application sees an authenticated user; everyone else sees a
login page served by Cloudflare. Crucially, this is a *different*
layer from Immich's own login. Access enforces "are you allowed to
even talk to this hostname," and Immich enforces "are you allowed to
look at these photos." Two locks, two keys, two failure domains. As
a learning exercise this was the most interesting layer to play
with — you can actually feel the difference between "auth at the
edge" and "auth at the app."

The catch is that Immich's mobile app speaks to its own API, not to
a browser flow, so you cannot put the API endpoint behind a
*browser*-only Access policy or the mobile app will get HTML when
it expects JSON. The
[Cloudflare Access service token](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)
mechanism is the standard answer; for a single-user test setup the
simpler path is to leave `/api/` paths open at the Access layer and
lean on Immich's own auth there, while applying the Access policy
to everything else. That is a real tradeoff — it means Immich's auth
is your only line of defense for the API surface — and you should
size the risk against your actual use case before you do it on
anything you care about.

For SSH, I followed
[Cloudflare's SSH-over-Access guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/).
`ssh ubuntu@ssh.example.com` now opens a browser, hits my identity
provider, and only then completes the handshake. The `cloudflared`
container handles that traffic the same way it handles the Immich
hostname — another ingress rule, same outbound tunnel. After that I
removed the SSH ingress rule from the OCI security list entirely.
The tunnel handles it. The host has, again, *zero* inbound rules
allowing anything from the public internet.

## What I learned, and what I'm not doing

Three things stood out from the experiment, two good and one
cautionary.

**Good:** Ampere A1 is plenty for a small Immich instance. Immich is
mostly I/O and Postgres-bound, and the
[block volume performance](https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/blockvolumeperformance.htm)
on a small allocation is more than enough for a test workload.
Machine learning jobs (smart search, face detection) run on CPU and
are slow, but they run in the background and I do not care.

**Good:** The Cloudflare side was completely hands-off. No
certificates to renew, no ports scanned, no scary log lines. Running
`cloudflared` as another Docker service in the same compose file
made the whole thing feel like one unit — start it, stop it, update
it, all with the same commands.

**Cautionary, and worth being explicit about:** Oracle's free tier
is a *developer offering*, not infrastructure I am entitled to.
Their [Always Free terms](https://www.oracle.com/cloud/free/)
make this clear, and there is precedent for idle or oversubscribed
resources getting reclaimed
([as discussed here](https://www.theregister.com/2024/04/18/oracle_cloud_idle_reclamation/)).
That is fine for a sandbox. It would be unwise for anything you
actually depend on. I am not running a "production" anything on
this — it is a test environment, with test data, that I expect to
throw away, and you should treat your own version of this the same
way.

I am also **not** trying to encourage anyone to abuse the free
tier. Don't park media libraries on it, don't run
revenue-generating workloads on it, don't claim a max-size instance
"just because." The reason free tiers like this exist is so people
can learn how cloud infrastructure fits together, and the reason
they survive is because most of us use them in that spirit. Be the
kind of user that keeps these programs around.

## The honest summary

Total cost: $0 in cloud, ~$10/year for a domain. Total ports opened
on the OCI host firewall: zero. Total ports opened in the OCI VCN
security list: zero. Total host ports published by Docker: zero.
Total photos uploaded for testing: a handful, deliberately. Total
things I now understand better than I did on Friday: OCI's
three-layer firewall model, the outbound-tunnel pattern,
identity-aware proxies, and the operational shape of Immich.

If the *idea* of self-hosting has been intimidating because of the
DDNS / certs / port-forward / home-IP dance, the
tunnel-in-a-container pattern collapses most of it. You add a second
service to your compose file and you are done. The only price is
trusting Cloudflare to be in the data path, which, depending on
your threat model, is either the whole point or a dealbreaker.

For me, this was an experiment, and the experiment worked. Whether
it ever becomes more than that is a different decision, with
different constraints, and probably a different kind of host
underneath.
