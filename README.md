---

# MAC0350 - Introdução ao Desenvolvimento de Sistemas de Software (2026)

Nesse repositório, você encontrará o código-fonte e os arquivos relacionados ao projeto individual da disciplina, assim como as resoluções das tarefas de classe e de casa. O projeto individual é focado na criação de um visualizador para o Problema de Visita de Polígonos (Touring Polygons Problem - TPP), onde os usuários poderão interagir com os elementos do problema e visualizar o processo de resolução do algoritmo.

## Projeto Individual

O Problema de Visita de Polígonos (Touring Polygons Problem - TPP) é um problema de otimização que envolve encontrar o caminho mais curto que parte de um ponto inicial $s$, visita uma sequência de polígonos convexos $P_1, P_2, \ldots, P_k$ em ordem, e chega a um ponto final $t$. Resolver esse problema é o tema central da minha iniciação científica, o repositório principal com todas as soluções, experimentos e relatórios pode ser encontrado [aqui](https://github.com/YushiPy/TouringPolygons).

Como projeto individual de `MAC0350 - Introdução ao Desenvolvimento de Sistemas de Software (2026)`, buscamos criar uma aplicação web que permita aos usuários visualizar o processo de resolução do TPP, mostrando os polígonos, o caminho encontrado e as etapas intermediárias.

A proposta é que a página web seja similar à plataforma [Desmos](https://www.desmos.com/calculator), onde os usuários possam interagir com os elementos do problema, como os polígonos e pontos de início e fim, e visualizar o caminho encontrado pelo algoritmo de resolução do TPP. Além disso, buscamos mostrar o processo de resolução, permitindo que os usuários vejam as etapas intermediárias do algoritmo, como a construção do mapa de último passo e região de primeiro contato.

Esse projeto contempla diversos aspectos da disciplina, sendo necessário aplicar o que aprendemos sobre HTML e CSS para criar uma interface visualmente atraente e funcional, além de utilizar JavaScript para implementar a lógica de interação e visualização do processo de resolução do TPP. Não só, buscamos permitir que o usuário possa salvar e carregar suas próprias instâncias do problema quando estiver logado, o que envolve a implementação de funcionalidades de backend para gerenciar os dados dos usuários e suas instâncias do TPP.

### O Problema

Formalmente, dado um ponto inicial $s$, um ponto final $t$ e uma sequência ordenada de polígonos convexos $P_1, P_2, \ldots, P_k$, o objetivo é encontrar o caminho mais curto que:
- parte de $s$,
- visita cada polígono em ordem (tocando ou cruzando cada um pelo menos uma vez),
- termina em $t$.

O TPP é um caso especial do **Problema do Caixeiro Viajante com Vizinhanças (TSPN)**, que por sua vez é uma generalização do TSP clássico. Ao contrário do TSPN geral, o TPP fixa a ordem de visita e restringe as vizinhanças a polígonos convexos — restrições que tornam o problema solúvel em tempo polinomial.

Para **polígonos não-convexos**, Dror et al. provaram que o problema é NP-difícil.

### Algoritmos

Os principais algoritmos implementados são:

| Artigo | Caso | Complexidade |
|---|---|---|
| Dror et al. (2003) | Polígonos não-intersectantes | $O(kn \log(n/k))$ |
| Dror et al. (2003) | Polígonos intersectantes | $O(k^2 n \log(n/k))$ |
| Tan & Jiang (2017) | Polígonos não-intersectantes | $O(kn)$ |

onde $k$ é o número de polígonos e $n$ é o número total de vértices.

O visualizador utiliza o algoritmo de **Dror et al.**, por ser mais direto de implementar. A melhoria de Tan & Jiang (que remove o fator logarítmico) está planejada para uma atualização futura.

> **Nota:** O caso de polígonos intersectantes ainda não está implementado. A solução pode ser incorreta se os polígonos se sobrepuserem.

### Polígonos Não-Convexos

Polígonos não-convexos ainda não são suportados. A abordagem planejada é calcular uma partição convexa ou cobertura convexa de cada polígono não-convexo e então aplicar uma busca branch-and-bound sobre as peças convexas resultantes. O canvas exibe um aviso `NOT CONVEX` e suprime a solução enquanto houver polígonos não-convexos.

### Funcionalidades

- Computação e renderização em tempo real do caminho mais curto
- Arrastar pontos, vértices e polígonos inteiros
- Adicionar e remover polígonos e vértices
- Seleção múltipla de pontos com retângulos de seleção aditivos
- Encaixe em interseções de subgrade
- Linhas de pré-visualização de vértice mostrando a posição de inserção antes do clique
- Contas de usuário com salvar, carregar, renomear, duplicar e excluir configurações
- Painel de desenhos com busca

### Tecnologias Utilizadas

- **Backend:** Python, FastAPI, SQLModel, SQLite
- **Frontend:** JavaScript puro, templates Jinja2, HTMX
- **Autenticação:** hash de senhas com bcrypt, cookies de sessão assinados via `itsdangerous`

### Estrutura do Projeto

```
├── main.py                  # Aplicação FastAPI e rotas
├── models.py                # Modelos de banco de dados SQLModel
├── static/
│   ├── css/
│   └── js/
│       ├── canvas.js        # Cena, renderização e tratamento de entrada
│       ├── utpp.js          # Implementação do solver do TPP
│       ├── vector2.js       # Matemática vetorial 2D
│       ├── settings.js      # Constantes globais
│       └── base.js          # Utilitários de UI compartilhados
├── templates/               # Templates HTML Jinja2
└── tpp.db                   # Banco de dados SQLite (criado na primeira execução)
```

### Como Executar Localmente

**Requisitos:** Python 3.10+

```bash
# Clone o repositório
git clone https://github.com/YushiPy/TouringPolygons
cd TouringPolygons/ProjetoIndividual

# Instale as dependências
pip install -r requirements.txt

# Inicie o servidor
uvicorn main:app --reload
```

Então abra `http://localhost:8000` no navegador.

### Limitações Conhecidas

- Polígonos intersectantes não são suportados — a solução pode ser incorreta se os polígonos se sobrepuserem
- Polígonos não-convexos suprimem a solução completamente
- Sem desfazer/refazer
- A ordem de visita dos polígonos é fixada na criação e não pode ser reordenada

### Referências

**Dror, M., Efrat, A., Lubiw, A., and Mitchell, J. S. B.** (2003). Touring a sequence of polygons. In *Proceedings of the 35th Annual ACM Symposium on Theory of Computing (STOC '03)*, pp. 473–482. https://doi.org/10.1145/780542.780612

**Tan, X. and Jiang, B.** (2017). Efficient algorithms for touring a sequence of convex polygons and related problems. In *Theory and Applications of Models of Computation — TAMC 2017*, Lecture Notes in Computer Science, vol. 10185, pp. 614–625. Springer. https://doi.org/10.1007/978-3-319-55911-7_44

---

## Tarefas de Classe e de Casa

A pasta `Tarefas` contém as resoluções das tarefas de classe e de casa, organizadas por aula, como apresentado em `https://webdev2025.lol`. Toda tarefa de classe ou de casa está em uma pasta nomeada de acordo com a aula correspondente no formato `AulaX-Y` onde `X` é o número da aula e `Y` é `Sala` para tarefas de classe ou `Casa` para tarefas de casa.

---

## Nota sobre uso de IA

IA foi utilizada de forma pontual na escrita deste README e na página de descrição do TPP — essencialmente nas partes puramente textuais, não sendo utilizado para criação de código, o uso se limitou à parte de escrever texto corrido.
