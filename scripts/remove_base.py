from PIL import Image

def main():
    # Load public/logo.png
    img = Image.open("public/logo.png").convert("RGBA")
    w, h = img.size
    
    # The plant's horizontal base is located at y >= 229, and x between 94 and 127.
    # The trunk itself is between x=107 and x=114.
    # Let's make the base transparent, leaving only the vertical trunk (stem).
    datas = img.getdata()
    newData = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = img.getpixel((x, y))
            # If it's part of the horizontal stand of the plant trunk
            if y >= 229 and 94 <= x <= 127:
                # Keep the trunk stem (x between 107 and 114)
                if not (107 <= x <= 114):
                    newData.append((255, 255, 255, 0)) # make transparent
                    continue
            newData.append((r, g, b, a))
            
    img.putdata(newData)
    
    # Save the modified logo
    img.save("public/logo.png", "PNG")
    print("Successfully removed the plant horizontal base stand from public/logo.png")

if __name__ == "__main__":
    main()
