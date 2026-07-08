import { z } from "zod";

export const equipmentCategorySchema = z.enum(["bat", "glove", "cleats", "protective", "training"]);
