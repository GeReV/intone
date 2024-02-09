import { Popup } from "~/popup/popup";

import "./common.css";
import "./popup.css";

(function () {
  console.log("hello");
  // if (queryString.isPopup) $("body").addClass("is-popup");
  // else getCurrentTab().then(function (currentTab) {
  //   return updateSettings({ readAloudTab: currentTab.id });
  // });

  const popup = new Popup();

  void popup.init();
})();
