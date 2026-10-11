export default {
  layout: "base.njk",
  date: "git Last Modified",
  permalink: (data) => data.page.filePathStem === "/index" ? "/" : `${data.page.filePathStem}/`
};
