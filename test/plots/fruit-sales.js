import * as Plot from "@observablehq/plot";
import * as d3 from "d3";

export default async function () {
  const sales = await d3.csv("data/fruit-sales.csv", d3.autoType);
  return Plot.plot({
    marginLeft: 50,
    y: {
      label: null,
      reverse: true
    },
    marks: [
      Plot.barX(sales, Plot.groupY({x: "sum"}, {x: "units", y: "fruit", sort: {y: "x", reverse: true}})),
      Plot.ruleX([0])
    ]
  });
}
