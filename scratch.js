const pkgFromSupabase = { id: 1, name: "test" };
const adminPartition = { id: 1, name: "test", hidden: true };
const merged = { ...adminPartition, ...pkgFromSupabase };
console.log(merged.hidden);
