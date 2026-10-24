import os
import csv
import shutil
import random
from collections import defaultdict

def sample_palmar_benchmark():
    csv_path = r"D:\benchmark_public\HandInfo.csv"
    images_dir = r"D:\benchmark_public\Hands"
    output_dir = r"D:\benchmark_public\sample40"
    output_csv = os.path.join(output_dir, "sample40.csv")

    random.seed(42)

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    # Filter aspectOfHand containing 'palmar'
    palmar_rows = [r for r in rows if "palmar" in r.get("aspectOfHand", "").lower()]
    print(f"Total palmar rows: {len(palmar_rows)}")

    # Group by (skinColor, laterality)
    # Target groups: skinColor in ['very fair', 'fair', 'medium', 'dark'], laterality in ['left', 'right']
    groups = defaultdict(list)
    for r in palmar_rows:
        img_name = r["imageName"]
        img_path = os.path.join(images_dir, img_name)
        if not os.path.exists(img_path):
            continue
        
        skin = r["skinColor"].strip().lower()
        aspect = r["aspectOfHand"].strip().lower()
        laterality = "left" if "left" in aspect else ("right" if "right" in aspect else "unknown")
        if laterality == "unknown":
            continue
        
        groups[(skin, laterality)].append(r)

    print("Available images per group:")
    for grp, r_list in sorted(groups.items()):
        unique_ids = len(set(r["id"] for r in r_list))
        print(f"  {grp}: {len(r_list)} images, {unique_ids} unique IDs")

    # Select 5 images per group balanced across unique IDs if possible
    selected_rows = []
    target_groups = [
        ("very fair", "left"),
        ("very fair", "right"),
        ("fair", "left"),
        ("fair", "right"),
        ("medium", "left"),
        ("medium", "right"),
        ("dark", "left"),
        ("dark", "right")
    ]

    for grp in target_groups:
        candidates = groups.get(grp, [])
        if len(candidates) < 5:
            raise ValueError(f"Not enough candidates for group {grp}: only {len(candidates)}")
        
        # Pick from distinct IDs first
        by_id = defaultdict(list)
        for r in candidates:
            by_id[r["id"]].append(r)
        
        chosen_for_group = []
        id_keys = list(by_id.keys())
        random.shuffle(id_keys)
        
        # Take 1 image from each unique id
        for uid in id_keys:
            img_choice = random.choice(by_id[uid])
            chosen_for_group.append(img_choice)
            if len(chosen_for_group) == 5:
                break
        
        # Fallback if fewer than 5 unique IDs
        if len(chosen_for_group) < 5:
            remaining = [r for r in candidates if r not in chosen_for_group]
            random.shuffle(remaining)
            chosen_for_group.extend(remaining[:(5 - len(chosen_for_group))])

        print(f"Group {grp} selected {len(chosen_for_group)} images:")
        for r in chosen_for_group:
            print(f"    ID: {r['id']}, Image: {r['imageName']}, Skin: {r['skinColor']}, Aspect: {r['aspectOfHand']}")
        selected_rows.extend(chosen_for_group)

    print(f"\nTotal selected rows: {len(selected_rows)}")
    os.makedirs(output_dir, exist_ok=True)

    # Copy files
    print(f"Copying {len(selected_rows)} images to {output_dir}...")
    for r in selected_rows:
        src = os.path.join(images_dir, r["imageName"])
        dst = os.path.join(output_dir, r["imageName"])
        shutil.copy2(src, dst)

    # Write sample40.csv
    print(f"Writing CSV to {output_csv}...")
    with open(output_csv, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(selected_rows)

    print("Sample generation complete!")

if __name__ == "__main__":
    sample_palmar_benchmark()
