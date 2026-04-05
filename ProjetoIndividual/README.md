
# Touring Polygons Problem — Interactive Visualizer

An interactive web visualizer for the **Touring Polygons Problem (TPP)**: a geometric optimization problem where you find the shortest path starting at a point $s$, visiting a sequence of convex polygons in order, and ending at a point $t$.

The canvas updates in real time as you drag points and polygons around. User accounts allow saving and loading configurations.

A detailed technical report (~20 pages) explaining the algorithms is available in this repository, along with standalone implementations.

---

## The problem

Given a start point $s$, a target point $t$, and an ordered sequence of convex polygons $P_1, P_2, \ldots, P_k$, find the shortest path that:
- starts at $s$,
- visits each polygon in order (touching or crossing each at least once),
- ends at $t$.

The TPP is a special case of the **Traveling Salesman Problem with Neighborhoods (TSPN)**, which is itself a generalization of the classic TSP. Unlike the general TSPN, the TPP fixes the visit order and restricts neighborhoods to convex polygons — constraints that make the problem solvable in polynomial time.

For **non-convex polygons**, Dror et al. proved the problem is NP-hard.

### Algorithms

| Paper | Case | Complexity |
|---|---|---|
| Dror et al. (2003) | Non-intersecting polygons | $O(kn \log(n/k))$ |
| Dror et al. (2003) | Intersecting polygons | $O(k^2 n \log(n/k))$ |
| Tan & Jiang (2017) | Non-intersecting polygons | $O(kn)$ |

where $k$ is the number of polygons and $n$ is the total number of vertices.

This visualizer uses the **Dror et al.** algorithm as it is more straightforward to implement. The Tan & Jiang improvement (which removes the log factor) is planned for a future update.

> **Note:** The intersecting polygon case is not yet implemented. The solution may be incorrect if polygons overlap.

### Non-convex polygons

Non-convex polygons are not yet supported. The planned approach is to compute a convex partition or convex cover of each non-convex polygon, then apply a branch-and-bound search over the resulting convex pieces. The canvas displays a `NOT CONVEX` warning and suppresses the solution until all polygons are convex.

---

## Features

- Real-time shortest path computation and rendering
- Drag points, vertices, and entire polygons
- Add and delete polygons and vertices
- Multi-point selection across polygons with additive selection rectangles
- Snapping to subgrid intersections
- Vertex preview lines showing insertion position before clicking
- User accounts with save, load, rename, duplicate, and delete for configurations
- Searchable drawings panel

---

## Stack

- **Backend:** Python, FastAPI, SQLModel, SQLite
- **Frontend:** Vanilla JS, Jinja2 templates, HTMX
- **Auth:** bcrypt password hashing, signed session cookies via `itsdangerous`

---

## Running locally

**Requirements:** Python 3.10+

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open `http://localhost:8000`.

---

## Project structure

```
├── main.py                  # FastAPI app and routes
├── models.py                # SQLModel database models
├── static/
│   ├── css/
│   └── js/
│       ├── canvas.js        # Scene, rendering, input handling
│       ├── utpp.js          # TPP solver implementation
│       ├── vector2.js       # 2D vector math
│       ├── settings.js      # Global constants
│       └── base.js          # Shared UI utilities
├── templates/               # Jinja2 HTML templates
└── tpp.db                   # SQLite database (created on first run)
```

---

## Known limitations

- Intersecting polygons are not supported — the solution may be incorrect if polygons overlap
- Non-convex polygons suppress the solution entirely
- No undo/redo
- Polygon visit order is fixed at creation and cannot be reordered

---

## References

**Dror, M., Efrat, A., Lubiw, A., and Mitchell, J. S. B.** (2003). Touring a sequence of polygons. In *Proceedings of the 35th Annual ACM Symposium on Theory of Computing (STOC '03)*, pp. 473–482. https://doi.org/10.1145/780542.780612

**Tan, X. and Jiang, B.** (2017). Efficient algorithms for touring a sequence of convex polygons and related problems. In *Theory and Applications of Models of Computation — TAMC 2017*, Lecture Notes in Computer Science, vol. 10185, pp. 614–625. Springer. https://doi.org/10.1007/978-3-319-55911-7_44