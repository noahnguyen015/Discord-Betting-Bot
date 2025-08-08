//chart.js uses <canvas> element in HTML to draw charts and graphs
//use chartjs-node-canvs for creating it in node.js
import { ChartJSNodeCanvas} from 'chartjs-node-canvas' //v4
import { ContextMenuCommandAssertions } from 'discord.js';

export async function graphLOLData(match_data, dates, datalabel, average){

  const chart = new ChartJSNodeCanvas({width: 300, height: 200});

  const threshholdPlugin = createLine();

  //slice, make shallow copy, reverse the copied array, then map it
  //make new array of all the bar colors
  //data needs to be reversed because graph goes past --> recent
      //but data is given recent --> past
  const barColors = match_data.slice().reverse().map(data => 
    data == average ? 'rgba(119, 118, 118, 1)': 
    data > average? 'rgba(66, 133, 60, 1)': 'rgba(141, 99, 255, 0.6)');

  //edit the settings of chart
  const settings = {
    type: 'bar',
    //the dates displayed as labels of every game
    data: {
      labels: [`${dates[4]['month']}/${dates[4]['day']}`,
              `${dates[3]['month']}/${dates[3]['day']}`,
              `${dates[2]['month']}/${dates[2]['day']}`,
              `${dates[1]['month']}/${dates[1]['day']}`,
              `${dates[0]['month']}/${dates[0]['day']}`,],
      
      //datasets (only 1) = the measured stat choice
      datasets: [{
        //label = kills, deaths, ...
        label: datalabel,
        //actual data of the chosen stat
        data: [match_data[4],match_data[3],match_data[2],match_data[1],match_data[0]],
        //arrow functions implicit return (knows to return the single expression/statement)
        //more than 1 line, needs return
        backgroundColor: barColors,
      }],
    },
    options: {
    //plugins to customize the chart and modify data before or after chart is drawn
    //change the font color of the legend labels and scales (both built-in plugins)
      plugins: {
        legend: {display: false},
        //configure custom plugin (use id: parameter not var name)
        threshholdLine: {y: average, color: 'rgba(255, 255, 255, 1)'},
      },
      //control styling and labels/ticks of x and y axis
      scales: {
        x: {ticks: { color: 'rgba(255, 255, 255, 1)', font: {size: 14}}},
        y: {ticks: { color: 'rgba(255, 255, 255, 1)', font: {size: 14}}},
      }
    },
    //register custom plugin that is defined
    //use variable name, not id: parameter
    plugins: [threshholdPlugin]
  }

  //sends the chart to image buffer in memory, but not saved in disk but buffer (make it a PNG)
  const buffer = await chart.renderToBuffer(settings);
  return buffer
}

export async function graphTFTData(match_data, dates, datalabel, average){

  const chart = new ChartJSNodeCanvas({width: 300, height: 200});
  const threshholdPlugin = createLine();

  const barColors = match_data.slice().reverse().map(data => 
    data == average ? 'rgba(119, 118, 118, 1)': 
    data > average? 'rgba(66, 133, 60, 1)': 'rgba(141, 99, 255, 0.6)');


  //edit the settings of chart
  const settings = {
    type: 'bar',
    //the dates displayed as labels of every game
    data: {
      labels: [`${dates[9]['month']}/${dates[9]['day']}`,
               `${dates[8]['month']}/${dates[8]['day']}`,
               `${dates[7]['month']}/${dates[7]['day']}`,
               `${dates[6]['month']}/${dates[6]['day']}`,
               `${dates[5]['month']}/${dates[5]['day']}`,
               `${dates[4]['month']}/${dates[4]['day']}`,
               `${dates[3]['month']}/${dates[3]['day']}`,
               `${dates[2]['month']}/${dates[2]['day']}`,
               `${dates[1]['month']}/${dates[1]['day']}`,
               `${dates[0]['month']}/${dates[0]['day']}`,],
      
      //datasets (only 1) = the measured stat choice
      datasets: [{
        //label = kills, deaths, ...
        label: datalabel,
        //actual data of the chosen stat
        data: [match_data[9],match_data[8],match_data[7],match_data[6],match_data[5],match_data[4],match_data[3],match_data[2],match_data[1],match_data[0]],
        backgroundColor: barColors,
      }],
    },
    options: {
    //change the font color of the legend labels
      plugins: {
        legend: {display: false},
        threshholdLine: {y: average, color: 'rgba(255, 255, 255, 1)'},
      },
      //control styling and labels/ticks of x and y axis
      scales: {
        x: {ticks: { color: 'rgba(255, 255, 255, 1)', font: {size: 14}}},
        y: {ticks: { color: 'rgba(255, 255, 255, 1)', font: {size: 14}}},
      }
    },
    plugins: [threshholdPlugin],
  }
  //sends the chart to image buffer in memory, but not saved in disk but buffer (make it a PNG)
  const buffer = await chart.renderToBuffer(settings);
  return buffer
}

function createLine(){
    const threshholdSettings = {
    //id for the plugin
    id: 'threshholdLine',
    //called after chart is drawn, chart object gives access to canvas, data, axes ...
    //define the afterChart method, assign new function to afterDraw
    afterDraw(chart) {
      //destructure to get  the context, chart left & right edges of chart area, y axis scale object
      const { ctx, chartArea: {left, right},  scales: { y }  } = chart;
      //reads threshhold value from settings/configuration
        //writing 'threshholdLine: {y: number} makes threshhold = number
      const threshhold = chart.config.options.plugins.threshholdLine.y;
      //color of the line, default = white
        //chooses first truth value, if parameter of color is given use it
      const lineColor = chart.config.options.plugins.threshholdLine.color || 'white';

      //conver the value of the threshhold to where it is in pixels on the graph
        //this tells us where the line will be
      const yPosition = y.getPixelForValue(threshhold);

      //start tracing a line
      ctx.beginPath();
      //moves to the left edge of chart of yPosition
      ctx.moveTo(left, yPosition);
      //draws line from left edge to right, at the y position
      ctx.lineTo(right, yPosition);
      ctx.lineWidth = 2;

      //set the color of the line
      ctx.strokeStyle = lineColor;
      //actually run and draw the line
      ctx.stroke();
      //remove settings and state to before so it doesn't affect other drawings
      ctx.restore();
    }
  }

  return threshholdSettings;
}
