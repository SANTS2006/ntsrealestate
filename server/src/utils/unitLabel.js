// How a rentable unit is named to people. `unit` must include its building
// (and the building its property).
//   whole property      -> "Sunrise Villa"
//   building rented whole -> "Sunrise Court — Block A"
//   unit in a property with units only -> "Sunrise Court — Unit 4"
//   unit in a building  -> "Sunrise Court — Block A, Unit 4"
export function unitTitle(unit) {
  const building = unit.building;
  const property = building.property;
  if (unit.isWhole && building.isImplicit) return property.name;
  if (unit.isWhole) return `${property.name} — ${building.name}`;
  if (building.isImplicit) return `${property.name} — Unit ${unit.unitNumber}`;
  return `${property.name} — ${building.name}, Unit ${unit.unitNumber}`;
}
