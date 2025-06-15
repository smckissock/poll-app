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
        const idSel = `#${field}`;

        this.dim   = config.facts.dimension(dc.pluck(field));
        this.group = this.dim.group().reduceSum(dc.pluck("count"));
        const chartWidth = (config.width ?? 120) * this.group.size();

        const wrapperDiv = d3.select("#bar-charts")
            .append("div")
            .attr("class", "chart-wrapper")
            .style("display", "inline-block")
            .style("width", `${chartWidth}px`)    
            .style("vertical-align", "top");        
    
        wrapperDiv
            .append("div")
            .attr("id", field);

        const chart = dc.barChart(idSel)
            .width(chartWidth)                  
            .height(config.height ?? 250)
            .margins({ top: 20, right: 10, bottom: 30, left: 40 })
            .dimension(this.dim)
            .group(this.group)
            .x(d3.scaleBand())
            .xUnits(dc.units.ordinal)
            .gap(10)
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

        wrapperDiv
            .append("div")
            .attr("id", `${field}-title`)
            .attr("class", "question-text")
            .style("width", "100%")                 
            .style("word-wrap", "break-word")     
            .style("white-space", "normal")     
            .text(title);
    }
}