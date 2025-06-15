/**
 * Wrapper around dc.js barChart.
 *
 * @param {string}  attribute   – column name used as the X category    
 * @param {string}  title       – text shown above the chart
 * @param {Object}  config      – {
 *       facts          : crossfilter,   // required
 *       barWidth       : 100,        // px  (optional)
 *       height         : 250,           // px  (optional)
 *       colors         : ["#83b4db"],   // single or multiple (optional)
 *       updateFunction : () => {}       // called on filter (optional)
 *   }
 */
export class BarChart {
    
    constructor(attribute, field, title, config) {
        this.dim   = config.facts.dimension(dc.pluck(field));
        this.group = this.dim.group().reduceSum(dc.pluck("count"));
        const chartWidth = (config.barWidth ?? 120) * this.group.size();

        const wrapperDiv = d3.select("#bar-charts")
            .append("div")
            .attr("class", "chart-wrapper")
            .style("display", "inline-block")
            .style("width", `${chartWidth}px`)    
            .style("vertical-align", "top");        
    
        wrapperDiv
            .append("div")
            .attr("id", field);

        const chart = dc.barChart("#" + field)
            .width(chartWidth)                  
            .height(config.height ?? 250)
            .margins({ top: 30, right: 40, bottom: 25, left: 40 })
            .dimension(this.dim)
            .group(this.group)
            .x(d3.scaleBand())
            .xUnits(dc.units.ordinal)
            .gap(6)
            .elasticY(true)
            .ordinalColors(config.colors ?? ["#83b4db"])
            .renderLabel(true)
            .title(d => `${d.key}: ${d.value.toLocaleString()}`)
            .on("filtered", () => {
                if (config.updateFunction) 
                    config.updateFunction();
            })
            .transitionDuration(0)                
            .on("postRender", c => {                
                c.transitionDuration(750);        
            })
                    
        chart.yAxis().ticks(4).tickFormat(d3.format(".2s"));

        // This doesn't work. Need a plan B
        //this.enableWrappedTicks(chart);

        wrapperDiv
            .append("div")
            .attr("id", `${field}-title`)
            .attr("class", "question-text")
            .style("width", "100%")                 
            .style("word-wrap", "break-word")     
            .style("white-space", "normal")     
            .text(title);
    }


/**
 * Wraps long x-axis tick labels on a dc.js barChart.
 *
 * @param {dc.barChart} chart       – your chart instance
 * @param {number}       estCharW   – avg. character width in px
 * @param {number}       lineEm     – line height (em) for tspan dy
 * @param {number}       offsetPx   – downward nudge for the whole label
 */
enableWrappedTicks(
  chart,
  estCharW  = 6.5,
  lineEm    = 1.1,
  offsetPx  = 20
) {
  /* -------- 1. give the axis a dynamic tick formatter -------- */
  const makeFormatter = () => {
    const barW     = chart.x().bandwidth();            // px
    const maxChars = Math.floor(barW / estCharW);

    return label => {
      const words = String(label).split(/\s+/);
      let line = [], out = [];

      words.forEach(w => {
        const test = [...line, w].join(" ");
        if (test.length > maxChars && line.length) {
          out.push(line.join(" "));
          line = [w];
        } else line.push(w);
      });
      out.push(line.join(" "));
      return out.join("\n");                           // keep \n placeholder
    };
  };

  chart
    .on("preRender.wrapTicks", () =>
      chart.xAxis().tickFormat(makeFormatter())
    )
    .on("preRedraw.wrapTicks", () =>
      chart.xAxis().tickFormat(makeFormatter())
    );

  /* -------- 2. after dc finishes transitions, replace \n with tspans -------- */
  chart.on("renderlet.wrapTicks", c => {
    c.selectAll(".x.axis .tick text").each(function () {
      const txt    = d3.select(this);
      const lines  = txt.text().split("\n");
      if (lines.length === 1) return;                  // nothing to wrap

      txt.text(null);                                  // clear original
      lines.forEach((l, i) =>
        txt.append("tspan")
           .attr("x", 0)
           .attr("dy", i ? lineEm + "em" : 0)
           .text(l)
      );

      /* nudge the whole multi-line label down */
      const y0 = +txt.attr("y") || 0;
      txt.attr("y", y0 + offsetPx);
    });
  });
}
}

