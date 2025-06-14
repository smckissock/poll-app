// BarChart.js  ────────────────────────────────────────────────────────────
//import * as d3 from "d3";
//import * as dc from "dc";

/**
 * Wrapper around dc.js barChart.
 *
 * @param {string}  attribute   – column name used as the X category    
 * @param {string}  title       – text shown above the chart
 * @param {Object}  config      – {
 *       facts          : crossfilter,   // required
 *       width          : 400,           // px  (optional)
 *       height         : 250,           // px  (optional)
 *       gap            : 2,             // px  (optional, space between bars)
 *       colors         : ["#83b4db"],   // single or multiple (optional)
 *       updateFunction : () => {}       // called on filter (optional)
 *   }
 */
export class BarChart {
  constructor(attribute, field, title, config) {
    const idSel = `#${field}`;
    
    d3.select("#bar-charts")
        .append("div")
        .attr("id", field);
    
    const container = d3.select(idSel);
    container.select(".chart-title").remove();          // get rid of any old one
    container.insert("div", ":first-child")
      .attr("class", "chart-title")
      .text(title);


    this.dim   = config.facts.dimension(dc.pluck(field));
    this.group = this.dim.group().reduceSum(dc.pluck("count"));

    const chart = dc.barChart(idSel)
      .width(config.width  ?? 400)
      .height(config.height ?? 250)
      .margins({ top: 20, right: 10, bottom: 30, left: 40 })
      .dimension(this.dim)
      .group(this.group)
      .x(d3.scaleBand())                    // ordinal (categorical) X
      .xUnits(dc.units.ordinal)
      .gap(config.gap ?? 2)
      .brushOn(true)                        // allow range selection
      .elasticY(true)
      .ordinalColors(config.colors ?? ["#83b4db"])
      .renderLabel(true)
      .ordering(d => -d.value)              // tallest bars on the left
      .title(d => `${d.key}: ${d.value.toLocaleString()}`)
      .on("filtered", () => {
        if (config.updateFunction) config.updateFunction();
      });

    // nice compact Y ticks
    chart.yAxis().ticks(4).tickFormat(d3.format(".2s"));
  }
}
