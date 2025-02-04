import {randomLcg} from "d3";
import {ascendingDefined, descendingDefined} from "../defined.js";
import {arrayify, isDomainSort, isOptions, maybeValue, valueof} from "../options.js";

// If both t1 and t2 are defined, returns a composite transform that first
// applies t1 and then applies t2.
export function basic({filter: f1, sort: s1, reverse: r1, transform: t1, initializer: i1, ...options} = {}, t2) {
  if (t1 === undefined) {
    // explicit transform overrides filter, sort, and reverse
    if (f1 != null) t1 = filterTransform(f1);
    if (s1 != null && !isDomainSort(s1)) t1 = composeTransform(t1, sortTransform(s1));
    if (r1) t1 = composeTransform(t1, reverseTransform);
  }
  if (t2 != null && i1 != null) throw new Error("transforms cannot be applied after initializers");
  return {
    ...options,
    ...((s1 === null || isDomainSort(s1)) && {sort: s1}),
    transform: composeTransform(t1, t2)
  };
}

// If both i1 and i2 are defined, returns a composite initializer that first
// applies i1 and then applies i2.
export function initializer({filter: f1, sort: s1, reverse: r1, initializer: i1, ...options} = {}, i2) {
  if (i1 === undefined) {
    // explicit initializer overrides filter, sort, and reverse
    if (f1 != null) i1 = filterTransform(f1);
    if (s1 != null && !isDomainSort(s1)) i1 = composeInitializer(i1, sortTransform(s1));
    if (r1) i1 = composeInitializer(i1, reverseTransform);
  }
  return {
    ...options,
    initializer: composeInitializer(i1, i2)
  };
}

function composeTransform(t1, t2) {
  if (t1 == null) return t2 === null ? undefined : t2;
  if (t2 == null) return t1 === null ? undefined : t1;
  return function (data, facets) {
    ({data, facets} = t1.call(this, data, facets));
    return t2.call(this, arrayify(data), facets);
  };
}

function composeInitializer(i1, i2) {
  if (i1 == null) return i2 === null ? undefined : i2;
  if (i2 == null) return i1 === null ? undefined : i1;
  return function (data, facets, channels, scales, dimensions) {
    let c1, d1, f1, c2, d2, f2;
    ({data: d1 = data, facets: f1 = facets, channels: c1} = i1.call(this, data, facets, channels, scales, dimensions));
    ({data: d2 = d1, facets: f2 = f1, channels: c2} = i2.call(this, d1, f1, {...channels, ...c1}, scales, dimensions));
    return {data: d2, facets: f2, channels: {...c1, ...c2}};
  };
}

function apply(options, t) {
  return (options.initializer != null ? initializer : basic)(options, t);
}

export function filter(value, options) {
  return apply(options, filterTransform(value));
}

function filterTransform(value) {
  return (data, facets) => {
    const V = valueof(data, value);
    return {data, facets: facets.map((I) => I.filter((i) => V[i]))};
  };
}

export function reverse(options) {
  return {...apply(options, reverseTransform), sort: null};
}

function reverseTransform(data, facets) {
  return {data, facets: facets.map((I) => I.slice().reverse())};
}

export function shuffle({seed, ...options} = {}) {
  return {...apply(options, sortValue(seed == null ? Math.random : randomLcg(seed))), sort: null};
}

export function sort(value, options) {
  return {
    ...(isOptions(value) && value.channel !== undefined ? initializer : apply)(options, sortTransform(value)),
    sort: null
  };
}

function sortTransform(value) {
  return (typeof value === "function" && value.length !== 1 ? sortData : sortValue)(value);
}

function sortData(compare) {
  return (data, facets) => {
    const compareData = (i, j) => compare(data[i], data[j]);
    return {data, facets: facets.map((I) => I.slice().sort(compareData))};
  };
}

function sortValue(value) {
  let channel, order;
  ({channel, value, order = ascendingDefined} = {...maybeValue(value)});
  if (typeof order !== "function") {
    switch (`${order}`.toLowerCase()) {
      case "ascending":
        order = ascendingDefined;
        break;
      case "descending":
        order = descendingDefined;
        break;
      default:
        throw new Error(`invalid order: ${order}`);
    }
  }
  return (data, facets, channels) => {
    let V;
    if (channel === undefined) {
      V = valueof(data, value);
    } else {
      if (channels === undefined) throw new Error("channel sort requires an initializer");
      V = channels[channel];
      if (!V) return {}; // ignore missing channel
      V = V.value;
    }
    const compareValue = (i, j) => order(V[i], V[j]);
    return {data, facets: facets.map((I) => I.slice().sort(compareValue))};
  };
}
