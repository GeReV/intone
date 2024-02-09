export const getMath = (function () {
  let promise = Promise.resolve<ReturnType<typeof makeMath> | null>(null);
  return () => {
    promise = promise.then(math => math ?? makeMath());

    return promise;
  };
})();

async function makeMath() {
//   const getXmlFromMathEl = function (mathEl) {
//     const clone = mathEl.cloneNode(true);
//     $("annotation, annotation-xml", clone).remove();
//     removeAllAttrs(clone, true);
//     return clone.outerHTML;
//   };
//
//   //determine the mml markup
//   const math =
//     when(document.querySelector(".MathJax, .MathJax_Preview"), {
//       selector: ".MathJax[data-mathml]",
//       getXML(el) {
//         const mathEl = el.querySelector("math");
//         return mathEl ? getXmlFromMathEl(mathEl) : el.getAttribute("data-mathml");
//       },
//     })
//       .when(() => document.querySelector("math"), {
//         selector: "math",
//         getXML: getXmlFromMathEl,
//       })
//       .else(null);
//
//   if (!math) return null;
//   const elems = $(math.selector).get();
//   if (!elems.length) return null;
//
//   //create speech surrogates
//   try {
//     const xmls = elems.map(math.getXML);
//     const texts = await ajaxPost(config.serviceUrl + "/read-aloud/mathml", xmls, "json").then(JSON.parse);
//     elems.forEach((el, i) => $("<span>").addClass("readaloud-mathml").text(texts[i] || "math expression").insertBefore(el));
//   } catch (err) {
//     console.error(err);
//     return {
//       show() {
//       },
//       hide() {
//       }
//     };
//   }
//
//   //return functions to toggle between mml and speech
  return {
    show() {
      // for (const el of elems) el.style.setProperty("display", "none", "important");
      // $(".readaloud-mathml").show();
    },
    hide() {
      // $(elems).css("display", "");
      // $(".readaloud-mathml").hide();
    }
  };
}