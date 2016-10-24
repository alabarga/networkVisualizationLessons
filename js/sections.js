/**
 * scrollVis - encapsulates
 * all the code for the visualization
 * using reusable charts pattern:
 * http://bost.ocks.org/mike/chart/
 */
var scrollVis = function() {
  "use strict";
  // constants to define the size
  // and margins of the vis area.
  var width = 700;
  var height = 520;
  var margin = {top:0, left:20, bottom:40, right:10};

  // Keep track of which visualization
  // we are on and which was the last
  // index activated. When user scrolls
  // quickly, we want to call all the
  // activate functions that they pass.
  var lastIndex = -1;
  var activeIndex = 0;

  // Sizing for the grid visualization
  var squareSize = 6;
  var squarePad = 2;
  var numPerRow = width / (squareSize + squarePad);

  // main canvas, context used for visualization
  var canvas = null;
  var context = null;

  // The force simulation
  var simulation = null;

  // A cluster nest for more efficiently drawing the clusters
  var clusters = null;

  // Node's radius
  var radius = 7;

  // Colors for clusters
  var color = d3.scaleOrdinal(d3.schemeCategory20);

  // Should we show images
  var HIDE_IMAGES = false;

  // List of nodes to be grayedOut
  var grayingOutList = [];
  var grayedOutList = [];


  // Variable to control how much should the nodes be grayed out
  var grayedLevel = 1.0;
  var grayedScale = d3.scaleLinear()
    .domain([0, 1.0])
    .range([1.0, 0.3]);


  // Currently visible nodes
  var filteredNodes = [];

  // When scrolling to a new section
  // the activation function for that
  // section is called.
  var activateFunctions = {};
  // If a section has an update function
  // then it is called while scrolling
  // through the section with the current
  //  through the section.
  var updateFunctions = {};

  /**
   * chart
   *
   * @param selection - the current d3 selection(s)
   *  to draw the visualization in. For this
   *  example, we will be drawing it in #vis
   */
  var chart = function(selection) {
    selection.each(function(graph) {

      //Load Data
      setupVis(graph);
      setupData(graph)

      // create svg and give it a width and height
      var canvasEle = d3.select(this).selectAll("canvas").data([graph]);
      canvasEle.enter().append("canvas");

      canvas = document.querySelector("canvas");
      context = canvas.getContext("2d");
      canvas.width = width;
      canvas.height = height;


      simulation = d3.forceSimulation()
          // .force("link", d3.forceLink().id(function (d) { return d.id; } ).strength(0.6).distance(100))
          // .force("charge", d3.forceManyBody().strength(-1))
          //Better than forceCenter because I can control the strength

          .force("x", d3.forceX(width/2).strength(0.03))
          .force("y", d3.forceY(height/2).strength(0.03))
          // .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collide", d3.forceCollide(radius+1).iterations(4))
          // .force("forceX", d3.forceCenter(width / 2, height / 2));
          // .force("forceY", d3.forceCenter(width / 2, height / 2));


      // d3.json("ieeevisNetwork.json", function(error, graph) {

      // if (error) throw error;
      console.log("Clustering");
      // netClustering.cluster(graph.nodes, graph.links);
      console.log("done");

      //Initialize without nodes
      updateNodes([]);



      simulation
          .on("tick", ticked);



      d3.select(canvas)
          .call(d3.drag()
              .container(canvas)
              .subject(dragsubject)
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended));




      setupSections();

      function ticked() {
        context.clearRect(0, 0, width, height);
        context.save();
        // context.translate(width / 2, height / 2);

        context.beginPath();
        if (chart.drawLinks) {
          simulation.force("link").links().forEach(drawLink);
          context.strokeStyle = 'rgba(200,200,200,0.5)';
          context.lineWidth = 0.5;
          context.stroke();
        }




        clusters.forEach(function(cluster) {
          context.beginPath();
          cluster.values.forEach(drawNode);
          context.fillStyle = color(cluster.key);
          context.fill();
        });

        context.restore();
      }

      function dragsubject() {
        return simulation.find(d3.event.x, d3.event.y);
      }
      // });

      function dragstarted() {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d3.event.subject.fx = d3.event.subject.x;
        d3.event.subject.fy = d3.event.subject.y;
      }

      function dragged() {
        d3.event.subject.fx = d3.event.x;
        d3.event.subject.fy = d3.event.y;
      }

      function dragended() {
        if (!d3.event.active) simulation.alphaTarget(0);
        d3.event.subject.fx = null;
        d3.event.subject.fy = null;
      }

      function drawLink(d) {
        context.moveTo(d.source.x+radius, d.source.y+radius);
        context.lineTo(d.target.x+radius, d.target.y+radius);
      }



      function drawNode(d) {
        if (HIDE_IMAGES) {
          context.moveTo(d.x + radius, d.y);
          context.arc(d.x, d.y, radius, 0, 2 * Math.PI);
        } else {

          context.save();

          // If a node is in this list it will be grayed out
          if (grayingOutList &&
            grayingOutList[d.id]!==undefined) {
            // console.log("globalAlpha" + grayedLevel);
            context.globalAlpha = grayedLevel;
            // console.log("globalAlpha");
            // console.log(context.globalAlpha);
          } else {
            if (grayedOutList &&
              grayedOutList[d.id]!==undefined) {
              context.globalAlpha = 0.3; //final value
            } else {
               context.globalAlpha = 1;
            }

          }


          context.beginPath();
          context.arc(d.x+radius, d.y+radius, radius, 0, Math.PI * 2, true);
          context.closePath();
          context.clip();

          context.drawImage(d.nodeImg, d.x, d.y, radius*2, radius*2);

          // context.beginPath();
          // context.arc(d.x, d.y, radius+10, 0, Math.PI * 2, true);
          // context.clip();
          // context.closePath();
          context.restore();
        }


      }



    });
  }; //chart

  chart.drawLinks = false;




  /**
   * setupVis - creates initial elements for all
   * sections of the visualization.
   *
   * @param wordData - data object for each word.
   * @param fillerCounts - nested data that includes
   *  element for each filler word type.
   * @param histData - binned histogram data
   */
  var setupVis = function(data) {

    d3.select("#nodeCount").text(data.nodes.filter(function (d) { return d.influential===false; }).length )
  };

  var setupData = function(graph) {
    graph.nodes.forEach(function (d) {
      d.nodeImg = new Image();
      d.nodeImg.src = d.profile_image_url;
      d.nodeImgData = null;
      d.nodeImg.onload = function() {
        console.log("Loaded image" + d.profile_image_url);
        d.nodeImgData = this;
      }
    });


    graph.links.forEach(function (d) {
      d.sourceID = d.source;
      d.targetID = d.target;
    });
  };

  /**
   * setupSections - each section is activated
   * by a separate function. Here we associate
   * these functions to the sections based on
   * the section's index.
   *
   */
  var setupSections = function() {
    var STEPS = 22;

    var nothingFn = function () {};
    // activateFunctions are called each
    // time the active section changes
    activateFunctions[0] = showTitle;
    activateFunctions[1] = showInfluentials;
    activateFunctions[2] = showAllNodes;
    activateFunctions[3] = showLinks;
    activateFunctions[4] = showLinks;
    activateFunctions[5] = showLinks;
    activateFunctions[6] = showLinks;
    // Rank by importance
    activateFunctions[7] = selectInfluentials;
    activateFunctions[8] = selectNeighborhood;
    activateFunctions[9] = rankByImportance;

    activateFunctions[10] = showLinks;
    // Compute clusters
    activateFunctions[11] = showClusters;
    activateFunctions[12] = showAllNodes;
    activateFunctions[13] = showFillerTitle;
    activateFunctions[14] = showFillerTitle;
    activateFunctions[15] = showFillerTitle;
    activateFunctions[16] = showAllNodes;
    activateFunctions[17] = showFillerTitle;
    activateFunctions[18] = showFillerTitle;
    activateFunctions[19] = showFillerTitle;
    activateFunctions[20] = showFillerTitle;
    activateFunctions[21] = showFillerTitle;


    // updateFunctions are called while
    // in a particular section to update
    // the scroll progress in that section.
    // Most sections do not need to be updated
    // for all scrolling and so are set to
    // no-op functions.
    for(var i = 0; i < STEPS; i++) {
      updateFunctions[i] = function() {};
    }
    updateFunctions[7] = updateGrayed;
    updateFunctions[8] = updateGrayed;
  };


function updateNodes(nodes) {
    simulation.nodes(nodes);
    clusters = d3.nest()
      .key(function(d) { return d.cluster; })
      .entries(nodes)
      .sort(function(a, b) { return b.values.length - a.values.length; });

    filteredNodes = nodes.slice(0);
    console.log("Updated nodes count:" + filteredNodes.length);
  }

  /**
  *  Shows only the links for the currently shown nodes
  */
  function updateLinks() {
    var dictNodes = {},
      allLinks = chart.graph.links,
      filteredLinks = [];

    filteredNodes.forEach(function (d) {
      dictNodes[d.id] = d;
    });

    filteredLinks = allLinks.filter(function (d) {
      return dictNodes[d.sourceID] !== undefined &&
        dictNodes[d.targetID] !== undefined;
    });


    console.log("updating links, all links count: " + allLinks.length +  " filtered: " + filteredLinks.length);

    simulation.force("link")
          .links(filteredLinks);

    console.log(simulation.links);

  }
  /**
   * ACTIVATE FUNCTIONS
   *
   * These will be called their
   * section is scrolled to.
   *
   * General pattern is to ensure
   * all content for the current section
   * is transitioned in, while hiding
   * the content for the previous section
   * as well as the next section (as the
   * user may be scrolling up or down).
   *
   */

  /**
   * showTitle - initial title
   *
   * hides: count title
   * (no previous step to hide)
   * shows: intro title
   *
   */
  function showTitle() {
    simulation.stop();
    context.clearRect(0, 0, width, height);
    context.save();

    context.font = "40px Arial";
    context.fillText("IEEEVIS Influentials",width/2-100,height/2);

    context.restore();
  }

  /**
   * showFillerTitle - filler counts
   *
   * hides: intro title
   * hides: square grid
   * shows: filler count title
   *
   */
  function showFillerTitle() {
    simulation.stop();
    context.clearRect(0, 0, width, height);
    context.save();

    context.font = "30px Arial";
    context.fillText("Too",10,50);

    context.restore();
  }


  function showInfluentials () {
    if (!chart.graph) return;
    context.clearRect(0, 0, width, height);
    simulation.stop();
    updateNodes(chart.graph.nodes.filter(function (d) { return d.influential === true; }));

    simulation.force("link", function () {})
    simulation.force("charge", function () {});
    simulation.alphaTarget(0.1).restart();
  }

  function showAllNodes () {
    if (!chart.graph) return;
    simulation.stop();
    chart.drawLinks = false;
    updateNodes(chart.graph.nodes);
    simulation.force("link", function () {});
    simulation.force("charge", function () {})
          .force("x", d3.forceX(width/2).strength(0.03))
          .force("y", d3.forceY(height/2).strength(0.03))

    simulation.alphaTarget(0.1).restart();
  }

  function showLinks () {
    if (!chart.graph) return;
    simulation.stop();
    chart.drawLinks = true;

    simulation.force("link", d3.forceLink().id(function (d) { return d.id; } ).strength(0.8).distance(150))
          .force("charge", d3.forceManyBody().strength(-100));

    simulation
          .force("x", function () {})
          .force("y", function () {})
          .force("center", d3.forceCenter(width/2, height/2))
          // .force("collide", function () {});

    updateLinks();

    grayedOutList = {};
    grayingOutList = {};

    simulation.alphaTarget(0.1).restart();
  }

  function selectInfluentials () {
    if (!chart.graph) return;
    simulation.stop();
    chart.drawLinks = false;


    // Remove links
    simulation.force("link", function () {})
          .force("charge", function () {});
    simulation.force("charge", function () {})
          .force("x", d3.forceX(width/2).strength(0.01))
          .force("y", d3.forceY(height/2).strength(0.01))
          // .force("collide", function () {});

    // Gray out all the nodes that are not influentials
    grayingOutList = {};
    chart.graph.nodes
      .filter(function (d) { return d.influential!== true; })
      .forEach(function (d) { grayingOutList[d.id]=d; });
    grayedScale.range([1.0, 0.1]);

    simulation.alphaTarget(0.1).restart();
  }

  function selectNeighborhood() {
    if (!chart.graph) return;
    simulation.stop();
    chart.drawLinks = false;

    // Leave the non influentials in gray
    grayedOutList = grayingOutList;
    // Bring back 200 other nodes
    grayingOutList = {};
    chart.graph.nodes.filter(function (d) { return d.influential!== true; })
    .slice(0,200)
    .forEach(function (d) { grayingOutList[d.id]=d; })

    grayedScale.range([0.3, 1.0]);


    // Remove links
    simulation.force("link", function () {})
          .force("charge", function () {});
    simulation.force("charge", function () {})
          .force("x", d3.forceX(width/2).strength(0.01))
          .force("y", d3.forceY(height/2).strength(0.01))
          // .force("collide", function () {});

    simulation.alphaTarget(0.1).restart();
  }

  function rankByImportance () {
    if (!chart.graph) return;
    simulation.stop();
    chart.drawLinks = false;

    updateNodes(chart.graph.nodes
      .filter(function (d) {
        return d.influential ||
          grayingOutList[d.id] !==undefined;
        }));

    // Remove links
    simulation.force("link", function () {})
          .force("charge", function () {});
    simulation.force("charge", function () {})
          .force("x", d3.forceX(width/2).strength(0.01))
          .force("y", d3.forceY(height/2).strength(0.01))
          // .force("collide", function () {});

    simulation.alphaTarget(0.1).restart();
  }

  function showClusters() {

  }

  // Update functions
  function updateGrayed(progress) {

    grayedLevel = grayedScale(progress);
    // simulation.restart();
    // console.log(progress + "," + grayedLevel);
  }

  /**
   * activate -
   *
   * @param index - index of the activated section
   */
  chart.activate = function(index) {
    activeIndex = index;
    var sign = (activeIndex - lastIndex) < 0 ? -1 : 1;
    var scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);
    scrolledSections.forEach(function(i) {
      activateFunctions[i]();
    });
    lastIndex = activeIndex;
  };

  /**
   * update
   *
   * @param index
   * @param progress
   */
  chart.update = function(index, progress) {
    updateFunctions[index](progress);
  };

  // return chart function
  return chart;
};


/**
 * display - called once data
 * has been loaded.
 * sets up the scroller and
 * displays the visualization.
 *
 * @param data - loaded tsv data
 */
var display = function(mGraph) {
  console.log("Data loaded");
  // create a new plot and
  // display it
  var plot = scrollVis();
  d3.select("#vis")
    .datum(mGraph)
    .call(plot);

  plot.graph = mGraph;

  console.log("Data loaded");
  console.log(plot.graph);

  // setup scroll functionality
  var scroll = scroller()
    .container(d3.select('#graphic'));

  // pass in .step selection as the steps
  scroll(d3.selectAll('.step'));

  // setup event handling
  scroll.on('active', function(index) {
    // highlight current step text
    d3.selectAll('.step')
      .style('opacity',  function(d,i) { return i == index ? 1 : 0.1; });

    // activate current section
    plot.activate(index);
  });

  scroll.on('progress', function(index, progress){
    plot.update(index, progress);
  });
};

// load data and display
d3.json("data/ieeevisNetworkClustered.json", display);
